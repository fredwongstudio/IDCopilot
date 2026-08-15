// Floor Plan Agent — Vercel serverless function
// File location: api/floor-plan-agent.js
// Vercel automatically exposes this at POST /api/floor-plan-agent

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FLOOR_PLAN_TOOL = {
  name: 'report_floor_plan_analysis',
  description: 'Report a structured analysis of a residential floor plan image.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A 1-3 sentence plain-language summary of the home, written directly to the homeowner.',
      },
      property_type: {
        type: 'string',
        description: 'Best guess at property type (e.g. BTO, Resale HDB, Condo), using the layout and any hints given.',
      },
      unit_type: {
        type: 'string',
        description: 'Best guess at unit type (e.g. 4-Room, 3-Bedroom), using the layout and any hints given.',
      },
      spaces: {
        type: 'array',
        items: { type: 'string' },
        description: 'Distinct rooms/spaces detected. Use the exact printed labels where visible (e.g. "Main Bedroom", "Household Shelter").',
      },
      fixed_elements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Structural or fixed elements that constrain design choices — load-bearing walls, household shelter, wet-area locations, visible door/window positions.',
      },
      opportunities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Design opportunities suggested by the layout (e.g. open-concept kitchen potential, natural storage zones).',
      },
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Things you are uncertain about and need the homeowner to confirm (e.g. unclear labels, ambiguous wall types).',
      },
      confidence: {
        type: 'string',
        description: 'A short, honest confidence statement and why (e.g. "High — labels are clearly printed" or "Low — image resolution is poor").',
      },
    },
    required: ['summary', 'property_type', 'unit_type', 'spaces', 'fixed_elements', 'opportunities', 'questions', 'confidence'],
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { floor_plan_data_url, project } = req.body || {};

    if (!floor_plan_data_url || typeof floor_plan_data_url !== 'string') {
      return res.status(400).json({ error: 'floor_plan_data_url is required' });
    }

    const match = floor_plan_data_url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'floor_plan_data_url must be a base64 image data URL' });
    }
    const [, mediaType, base64Data] = match;

    const hintText = [
      project?.property_type ? `The homeowner indicated this is a ${project.property_type} property.` : '',
      project?.unit_type ? `They indicated the unit type is ${project.unit_type}.` : '',
    ].filter(Boolean).join(' ');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      tools: [FLOOR_PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'report_floor_plan_analysis' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `This is a residential floor plan for an interior design app. ${hintText} Analyse the layout and report your findings using the report_floor_plan_analysis tool. Use the exact room labels printed on the plan where visible. Be specific and honest about uncertainty — do not confidently guess at things you cannot actually see in the image.`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse) {
      throw new Error('Model did not return a structured analysis');
    }

    res.status(200).json(toolUse.input);
  } catch (err) {
    console.error('Floor Plan Agent error:', err);
    res.status(500).json({ error: 'Floor plan analysis failed', detail: err.message });
  }
}
