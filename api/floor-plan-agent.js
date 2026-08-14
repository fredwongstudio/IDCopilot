import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string"
    },
    property_type: {
      type: "string"
    },
    unit_type: {
      type: "string"
    },
    spaces: {
      type: "array",
      items: { type: "string" }
    },
    fixed_elements: {
      type: "array",
      items: { type: "string" }
    },
    opportunities: {
      type: "array",
      items: { type: "string" }
    },
    questions: {
      type: "array",
      items: { type: "string" }
    },
    confidence: {
      type: "string"
    }
  },
  required: [
    "summary",
    "property_type",
    "unit_type",
    "spaces",
    "fixed_elements",
    "opportunities",
    "questions",
    "confidence"
  ]
};

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {

    const {
      floor_plan_data_url,
      project
    } = req.body || {};

    if (!floor_plan_data_url) {
      return res.status(400).json({
        error: "floor_plan_data_url is required"
      });
    }

    const prompt = `
You are the Floor Plan Agent inside ID Copilot.

ID Copilot is an AI interior-design application for homeowners
who are buying a BTO, Resale HDB or Condo.

Your job is to understand the supplied floor plan BEFORE
any interior design is generated.

Project information:

${JSON.stringify(project || {}, null, 2)}

Analyse the supplied floor-plan image.

Identify, where reasonably visible:

- rooms
- spatial zones
- circulation
- doors
- windows
- major fixed elements
- wet areas
- kitchen position
- potential storage opportunities
- potential design opportunities

Important rules:

1. Do not invent dimensions.
2. Do not assume something is visible if it isn't.
3. Clearly distinguish observations from assumptions.
4. Do not create the final interior design yet.
5. Flag anything the homeowner needs to confirm.
6. Use simple homeowner-friendly language.
7. This is a planning aid, not a construction drawing.

The purpose of this analysis is to create a reliable
spatial understanding that another AI Design Agent can
use later to generate the interior design.
`;

    const response = await client.responses.create({

      model: process.env.OPENAI_MODEL || "gpt-5.6",

      input: [
        {
          role: "user",

          content: [

            {
              type: "input_text",
              text: prompt
            },

            {
              type: "input_image",
              image_url: floor_plan_data_url
            }

          ]
        }
      ],

      text: {
        format: {
          type: "json_schema",
          name: "floor_plan_analysis",
          strict: true,
          schema: schema
        }
      }

    });

    const result = JSON.parse(
      response.output_text
    );

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      "Floor Plan Agent Error:",
      error
    );

    return res.status(500).json({
      error: "Floor plan analysis failed"
    });

  }
}
