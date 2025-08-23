import { PlannerService } from '@/modules/planner'

describe('PlannerService', () => {
  const planner = new PlannerService()

  test('parses Tu/Th evening block', async () => {
    const plans = await planner.createEventPlan({
      userId: 'u1',
      naturalLanguageInput: 'Block 7–9pm Tu/Th for EE labs; avoid Fridays'
    })
    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0].title.toLowerCase()).toContain('ee')
    expect(plans[0].confidence).toBeGreaterThan(0)
  })

  test('defaults duration when not provided', async () => {
    const plans = await planner.createEventPlan({
      userId: 'u1',
      naturalLanguageInput: 'Study tomorrow at 7'
    })
    const start = new Date(plans[0].startDateTime)
    const end = new Date(plans[0].endDateTime)
    const minutes = (end.getTime() - start.getTime()) / 60000
    expect(minutes).toBeGreaterThanOrEqual(60)
  })
})
