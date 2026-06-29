import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const energy_level: string | null = body.energy_level ?? null

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // Tasks already in today's plan
    const { data: todayPlan } = await supabase
      .from('daily_plan_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('plan_date', today)

    const todayTaskIds = new Set((todayPlan ?? []).map((t: any) => t.task_id))

    // All non-archived, non-snoozed tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, energy_level, task_type, daily_timebox_minutes, categories(name)')
      .eq('is_archived', false)
      .or(`snooze_until.is.null,snooze_until.lte.${today}`)

    const availableTasks = (tasks ?? []).filter((t: any) => !todayTaskIds.has(t.id))

    if (availableTasks.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // What the user has done in the last 7 days
    const { data: recentLogs } = await supabase
      .from('task_logs')
      .select('task_id, completed_date')
      .eq('user_id', user.id)
      .gte('completed_date', sevenDaysAgoStr)
      .order('completed_date', { ascending: false })

    const completionMap: Record<string, string> = {}
    for (const log of (recentLogs ?? [])) {
      if (!completionMap[log.task_id]) completionMap[log.task_id] = log.completed_date
    }

    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })

    const taskList = availableTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      energy_required: t.energy_level ?? 'medium',
      type: t.task_type,
      category: t.categories?.name ?? 'Uncategorized',
      preferred_duration_min: t.daily_timebox_minutes ?? null,
      last_done: completionMap[t.id] ?? 'never',
    }))

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `You are a personal productivity coach helping someone plan their ${dayOfWeek}.

User's current energy level: ${energy_level ? `**${energy_level}**` : 'not set (assume medium)'}.

Energy guide:
- high = user can tackle challenging, deep-focus work
- medium = handles normal tasks with moderate focus
- low = should do easy, routine, or light tasks only

Available tasks (not yet scheduled today):
${JSON.stringify(taskList, null, 2)}

Recommend exactly 3 to 5 tasks for today. Prioritize:
1. Matching task energy_required to the user's current energy level
2. Tasks never done or done longest ago (last_done: "never" or oldest dates)
3. A variety of categories when possible
4. Weekend vs weekday context (it's ${dayOfWeek})

Return ONLY a raw JSON array — absolutely no markdown, no explanation outside the array:
[{"task_id":"<id>","reason":"<one sentence why this task fits today>"}]`,
      }],
    })

    const textBlock = response.content.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block in AI response')

    let recommendations: Array<{ task_id: string; reason: string }>
    try {
      recommendations = JSON.parse(textBlock.text)
    } catch {
      const match = textBlock.text.match(/\[[\s\S]*?\]/)
      if (!match) throw new Error('Could not parse AI recommendations as JSON')
      recommendations = JSON.parse(match[0])
    }

    const enriched = recommendations
      .map((rec) => {
        const task = availableTasks.find((t: any) => t.id === rec.task_id)
        return task ? { task_id: rec.task_id, reason: rec.reason, task } : null
      })
      .filter(Boolean)

    return new Response(JSON.stringify({ recommendations: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('recommend-tasks error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
