import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { generateWeeklyBrief } from './lib/weekly-brief'

console.log('Starting weekly brief generation...')
const result = await generateWeeklyBrief()
console.log('Result:', JSON.stringify(result, null, 2))
