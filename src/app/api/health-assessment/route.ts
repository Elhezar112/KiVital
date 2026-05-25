import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const BASELINES = `
## Healthy Reference Ranges

### Cats
- Daily water intake: 40–60 ml per kg body weight (e.g. 4 kg cat → 160–240 ml/day). Below 30 ml/kg = concerning.
- Daily food intake: ~200–280 kcal/day for average adult cat (4–5 kg). Rough guide: 60–70g dry kibble or 200g wet food.
- Litter box visits: 2–4 times/day normal. <1/day may indicate constipation or blockage. >6/day may indicate UTI, diabetes, or IBD.
- Resting weight change: >5% loss or gain within a week is a red flag.
- Senior cats (≥7 years): stricter monitoring — weight loss, increased thirst, litter changes are early disease signals.

### Dogs
- Daily water intake: 50–100 ml per kg body weight. Below 40 ml/kg = potentially concerning.
- Daily food intake: varies widely by breed and size. Flag if owner notes "refused to eat" or very large deviations.
- Exercise: small breeds ≥20 min/day; medium breeds ≥45 min/day; large breeds ≥60 min/day. Less = sedentary risk.
- Weight change: >3% loss/gain per week is worth noting.
`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, logData } = await request.json()
  if (!petId || !logData) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const ageYears = pet.birthday
    ? Math.floor((Date.now() - pet.birthday.getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  const prompt = `You are a veterinary health assistant performing an instant health check.

${BASELINES}

## Pet Profile
- Name: ${pet.name}
- Species: ${pet.species}
- Breed: ${pet.breed ?? 'Unknown'}
- Age: ${ageYears != null ? `${ageYears} years` : 'Unknown'}
- Weight: ${pet.weightKg ?? 'Unknown'} kg
- Neutered: ${pet.neutered ? 'Yes' : 'No'}
- Known conditions: ${pet.conditions.length > 0 ? pet.conditions.join(', ') : 'None'}
- Medical notes: ${pet.medicalNotes ?? 'None'}

## Today's Log
- Food intake: ${logData.foodGrams != null ? `${logData.foodGrams}g` : 'Not recorded'}
- Water intake: ${logData.waterMl != null ? `${logData.waterMl}ml` : 'Not recorded'}
${pet.species === 'CAT' ? `- Litter box visits: ${logData.litterVisits != null ? logData.litterVisits : 'Not recorded'}` : `- Walk duration: ${logData.walkMinutes != null ? `${logData.walkMinutes} min` : 'Not recorded'}`}
- Weight today: ${logData.weightKg != null ? `${logData.weightKg}kg` : 'Not recorded'}
- Owner notes: ${logData.notes ?? 'None'}

## Task
Compare today's log against healthy reference ranges and the pet's profile.
For each recorded metric, assess if it is within a healthy range.
If any metric is abnormal, list possible underlying health issues to watch for.

Respond ONLY with valid JSON in this exact format:
{
  "overallStatus": "healthy" | "warning" | "alert",
  "summary": "One sentence overall assessment",
  "metrics": [
    {
      "name": "metric name in the user's likely language (English)",
      "status": "normal" | "low" | "high" | "concerning",
      "value": "what was recorded",
      "message": "brief explanation",
      "possibleIssues": ["issue1", "issue2"]
    }
  ],
  "advice": "One actionable sentence for the owner. If alert, recommend vet visit."
}

Only include metrics that were actually recorded. Keep messages concise (under 15 words each). possibleIssues should only be filled for non-normal statuses.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const assessment = JSON.parse(jsonMatch[0])

    // Persist to database
    await prisma.instantAssessment.create({
      data: {
        petId,
        userId: user.id,
        logDate: new Date(logData.date),
        overallStatus: assessment.overallStatus,
        summary: assessment.summary,
        metricsJson: assessment.metrics,
        advice: assessment.advice,
      },
    })

    return NextResponse.json(assessment)
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const assessments = await prisma.instantAssessment.findMany({
    where: { petId, userId: user.id },
    orderBy: { logDate: 'desc' },
  })

  return NextResponse.json(assessments)
}
