import { getName } from '../getName.js'

describe('getName', () => {
  it('gets the unique identifier for this worker', () => {
    const name = getName()
    expect(name).toBeString()
  })
})
