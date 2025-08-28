import { PlannerService } from '@/modules/planner'

describe('PlannerService', () => {
  const planner = new PlannerService()

  test('parses Tu/Th 7-9pm study request', async () => {
    const plans = await planner.createEventPlan({ naturalLanguageInput: 'study 7-9pm Tu/Th' } as any)
    expect(plans.length).toBeGreaterThan(0)
    const anyTueThu = plans.some(p => {
      const d = new Date(p.startDateTime)
      return [2,4].includes(d.getDay()) && (new Date(p.endDateTime).getTime() - d.getTime()) === 2*60*60*1000
    })
    expect(anyTueThu).toBe(true)
  })

  test('respects avoid Fridays', async () => {
    const plans = await planner.createEventPlan({ naturalLanguageInput: 'study 7-8pm, avoid Friday' } as any)
    const anyFriday = plans.some(p => new Date(p.startDateTime).getDay() === 5)
    expect(anyFriday).toBe(false)
  })
})


