import fs from 'fs'
import path from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildExtractionPrompt } from '../lib/extractionPrompt'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

async function main() {
  // Step 1 — Read the PDF file from disk
  const pdfPath = path.join(process.cwd(), 'data', 'UHCBotulinum.pdf')
  const pdfBuffer = fs.readFileSync(pdfPath)

  console.log('Parsing PDF...')
  const pdfData = await pdfParse(pdfBuffer)
  const text = pdfData.text
  console.log(`Extracted ${text.length} characters from PDF`)
  console.log('First 500 chars:', text.slice(0, 500))

  // Step 2 — Send to Gemini
  console.log('\nSending to Gemini...')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = buildExtractionPrompt(text)
  const result = await model.generateContent(prompt)
  const rawResponse = result.response.text()

  console.log('\nRaw Gemini response (first 1000 chars):')
  console.log(rawResponse.slice(0, 1000))

  // Step 3 — Parse the JSON
  console.log('\nParsing JSON...')
  const clean = rawResponse.replace(/```json|```/g, '').trim()
  const extracted = JSON.parse(clean)

  // Step 4 — Print summary
  console.log('\n--- EXTRACTION SUMMARY ---')
  console.log('Payer:', extracted.policy_metadata?.payer_name)
  console.log('Policy:', extracted.policy_metadata?.policy_title)
  console.log('Effective Date:', extracted.policy_metadata?.effective_date)
  console.log('Drugs found:', extracted.drugs?.length)
  console.log('Coverage rules found:', extracted.coverage_rules?.length)

  extracted.coverage_rules?.forEach((rule: { drug_brand_name: string; overall_coverage_status: string; requires_prior_auth: boolean; indications?: Array<{ indication_name: string; coverage_status: string; pa_criteria?: { criteria?: unknown[]; step_therapy?: unknown[] } }> }) => {
    console.log(`\n  Drug: ${rule.drug_brand_name}`)
    console.log(`  Status: ${rule.overall_coverage_status}`)
    console.log(`  Prior Auth: ${rule.requires_prior_auth}`)
    console.log(`  Indications: ${rule.indications?.length}`)
    rule.indications?.slice(0, 2).forEach((ind) => {
      console.log(`    - ${ind.indication_name} (${ind.coverage_status})`)
      console.log(`      PA criteria: ${ind.pa_criteria?.criteria?.length} items`)
      console.log(`      Step therapy: ${ind.pa_criteria?.step_therapy?.length} steps`)
    })
  })

  // Step 5 — Save full output to file for inspection
  const outputPath = path.join(process.cwd(), 'data', 'extracted_output.json')
  fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2))
  console.log(`\nFull output saved to: ${outputPath}`)
}

main().catch(console.error)
