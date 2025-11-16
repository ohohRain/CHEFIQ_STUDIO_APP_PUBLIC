import { openai } from '../config/openai';
import * as FileSystem from 'expo-file-system';

/**
 * AI Service for recipe parsing and generation
 * Uses OpenAI GPT-4 for text parsing and GPT-4o with vision for image OCR
 */

/**
 * Validate parsed recipe data has required fields
 * @param {Object} parsed - Parsed JSON from GPT-4
 * @throws {Error} If validation fails
 */
const validateParsedData = (parsed) => {
  // Check for error response from GPT-4
  if (parsed.success === false) {
    const errorMessages = {
      'NO_TEXT': 'No text detected in image. Please retake or choose a clearer photo.',
      'UNREADABLE': 'Image is too blurry or unclear. Please try better lighting or focus.',
      'NOT_RECIPE': "This doesn't appear to be a recipe. Please upload recipe text or use manual entry."
    };
    throw new Error(errorMessages[parsed.errorType] || 'Unable to parse recipe from image.');
  }

  // Validate required fields
  if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
    throw new Error('Invalid response: missing ingredients array');
  }
  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error('Invalid response: missing steps array');
  }
};

/**
 * Transform parsed GPT-4 data into RecipeFormScreen format
 * @param {Object} parsed - Parsed JSON from GPT-4
 * @returns {Object} Formatted recipe data for RecipeFormScreen
 */
const transformParsedRecipe = (parsed) => {
  return {
    title: parsed.title || 'Untitled Recipe',
    cuisine: parsed.cuisine || 'Other',
    difficulty: parsed.difficulty || 'Medium',
    cookingTime: parsed.cookingTime || 30,
    ingredients: parsed.ingredients.map((ing, idx) => ({
      id: `ai-ing-${Date.now()}-${idx}`,
      name: ing.name || '',
      amount: ing.amount || ''
    })),
    steps: parsed.steps.map((step, idx) => ({
      id: `ai-step-${Date.now()}-${idx}`,
      number: idx + 1,
      description: typeof step === 'string' ? step : step.description || '',
      image: null
    }))
  };
};

/**
 * Handle AI service errors with user-friendly messages
 * @param {Error} error - Error from OpenAI API or parsing
 * @throws {Error} User-friendly error message
 */
const handleAIServiceError = (error) => {
  console.error('[aiService] Error:', error);

  // Handle specific error types
  if (error.message?.includes('API key')) {
    throw new Error('OpenAI API key not configured. Please check your .env file.');
  }
  if (error.message?.includes('rate limit') || error.status === 429) {
    throw new Error('Too many requests. Please wait a moment and try again.');
  }
  if (error.message?.includes('network') || error.code === 'ENOTFOUND') {
    throw new Error('Unable to connect. Please check your internet connection.');
  }
  if (error.message?.includes('Invalid response') || error.message?.includes('No text detected') || error.message?.includes('too blurry')) {
    throw error; // Pass through validation errors as-is
  }

  // Generic error
  throw new Error('Unable to parse recipe. Please try rephrasing or use manual entry.');
};

/**
 * Parse recipe text and extract structured data
 * @param {string} recipeText - Raw recipe text from user
 * @returns {Promise<Object>} Structured recipe data compatible with RecipeFormScreen
 * @throws {Error} If API call fails or parsing fails
 */
export const parseRecipeText = async (recipeText) => {
  if (!recipeText || !recipeText.trim()) {
    throw new Error('Please provide recipe text to parse');
  }

  try {
    console.log('[aiService] Parsing recipe text...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional recipe parser. Extract structured data from recipe text and return ONLY valid JSON.

Rules:
1. Extract title, cuisine type, difficulty level, ingredients with amounts, and cooking steps
2. Ingredients: Parse into {name, amount} format. If amount is missing, use empty string
3. Steps: Parse into numbered array of step descriptions
4. Cuisine: Choose from: Chinese, Italian, Japanese, Korean, Thai, Vietnamese, Indian, Mexican, French, American, Mediterranean, Middle Eastern, Other
5. Difficulty: Choose from: Easy, Medium, Hard
6. If information is unclear, make reasonable assumptions
7. Return ONLY the JSON object, no additional text

Response format:
{
  "title": "Recipe title",
  "cuisine": "Cuisine type",
  "difficulty": "Easy|Medium|Hard",
  "cookingTime": 30,
  "ingredients": [
    {"name": "ingredient name", "amount": "quantity with unit"}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}`
        },
        {
          role: 'user',
          content: recipeText
        }
      ],
      temperature: 0.3, // Low temperature for consistent parsing
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log('[aiService] Raw response:', content);

    const parsed = JSON.parse(content);
    console.log('[aiService] Parsed data:', parsed);

    // Validate and transform
    validateParsedData(parsed);
    const transformedData = transformParsedRecipe(parsed);

    console.log('[aiService] Transformed data:', transformedData);
    return transformedData;

  } catch (error) {
    handleAIServiceError(error);
  }
};

/**
 * Parse recipe from image using GPT-4o Vision (OCR)
 * Performs OCR and recipe parsing in a single API call
 * @param {string} imageUri - Local URI of recipe image (file://)
 * @returns {Promise<Object>} Structured recipe data compatible with RecipeFormScreen
 * @throws {Error} If image is unreadable, contains no text, or not a recipe
 */
export const parseRecipeImage = async (imageUri) => {
  if (!imageUri) {
    throw new Error('Please provide an image to parse');
  }

  try {
    console.log('[aiService] Parsing recipe image:', imageUri);

    // Step 1: Convert image to base64 using FileSystem API
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[aiService] Image converted to base64 (length:', base64.length, ')');

    // Step 2: Determine image format from URI
    const imageFormat = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    const dataUrl = `data:image/${imageFormat};base64,${base64}`;

    // Step 3: Call GPT-4o with vision for OCR + parsing
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4o has vision capabilities
      messages: [
        {
          role: 'system',
          content: `You are a professional recipe OCR and parser. Extract recipe content from images and return structured data as JSON.

Your task:
1. Examine the image for readable text (handwritten or printed)
2. If no text is visible OR text is too blurry/unclear to read, return: {"success": false, "errorType": "UNREADABLE"}
3. If text exists but is NOT a recipe (e.g., article, menu, random notes), return: {"success": false, "errorType": "NOT_RECIPE"}
4. If text is a readable recipe, extract and parse it into structured JSON

Extraction rules:
- Handle both handwritten and printed text
- Be lenient with image quality but flag truly unreadable text
- Extract title, cuisine, difficulty, cooking time, ingredients (with amounts), and steps
- Cuisine: Choose from: Chinese, Italian, Japanese, Korean, Thai, Vietnamese, Indian, Mexican, French, American, Mediterranean, Middle Eastern, Other
- Difficulty: Choose from: Easy, Medium, Hard
- If information is missing, make reasonable assumptions

Success response format:
{
  "success": true,
  "title": "Recipe title",
  "cuisine": "Cuisine type",
  "difficulty": "Easy|Medium|Hard",
  "cookingTime": 30,
  "ingredients": [
    {"name": "ingredient name", "amount": "quantity with unit"}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}

Error response format:
{
  "success": false,
  "errorType": "UNREADABLE" | "NOT_RECIPE"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please extract and parse the recipe from this image. If the image is unreadable or not a recipe, return the appropriate error response.'
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      temperature: 0.3, // Low temperature for consistent OCR
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log('[aiService] OCR raw response:', content);

    const parsed = JSON.parse(content);
    console.log('[aiService] OCR parsed data:', parsed);

    // Validate and transform
    validateParsedData(parsed);
    const transformedData = transformParsedRecipe(parsed);

    console.log('[aiService] OCR transformed data:', transformedData);
    return transformedData;

  } catch (error) {
    handleAIServiceError(error);
  }
};

/**
 * Recognize food ingredients from image using GPT-4o Vision
 * @param {string} imageUri - Local URI of food image (file://)
 * @returns {Promise<string[]>} Array of recognized ingredient names
 * @throws {Error} If no food detected or image is unreadable
 */
export const recognizeIngredientsFromImage = async (imageUri) => {
  if (!imageUri) {
    throw new Error('Please provide an image');
  }

  try {
    console.log('[aiService] Recognizing ingredients from image:', imageUri);

    // Step 1: Convert image to base64 using FileSystem API
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const imageFormat = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    const dataUrl = `data:image/${imageFormat};base64,${base64}`;

    // Step 2: Call GPT-4o Vision for food recognition
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional food recognition AI. Identify food ingredients visible in images.

CRITICAL VALIDATION RULES:
1. ONLY identify items that are clearly FOOD INGREDIENTS
2. If image contains NO food items → return: {"success": false, "errorType": "NO_FOOD"}
3. If image is too blurry/dark to identify food → return: {"success": false, "errorType": "UNREADABLE"}
4. If image contains prepared dishes, identify the likely ingredients (e.g., "pasta dish" → ["pasta", "tomato sauce", "basil"])
5. Ignore non-food items (plates, utensils, backgrounds)

IMPORTANT: Return your response in JSON format with one of these structures:

Success response format:
{
  "success": true,
  "ingredients": ["ingredient1", "ingredient2", ...]
}

Error response format:
{
  "success": false,
  "errorType": "NO_FOOD" | "UNREADABLE",
  "message": "User-friendly error message"
}

Examples:
- Image of vegetables → {"success": true, "ingredients": ["carrot", "broccoli", "onion"]}
- Image of empty plate → {"success": false, "errorType": "NO_FOOD"}
- Image of a person → {"success": false, "errorType": "NO_FOOD"}
- Blurry image → {"success": false, "errorType": "UNREADABLE"}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify all food ingredients visible in this image. If no food is present or image is unreadable, return the appropriate error response in JSON format.'
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl }
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log('[aiService] Food recognition raw response:', content);

    const parsed = JSON.parse(content);
    console.log('[aiService] Food recognition parsed:', parsed);

    // Handle error responses
    if (parsed.success === false) {
      const errorMessages = {
        'NO_FOOD': 'No food items detected in this image. Please take a photo of your ingredients or use text input.',
        'UNREADABLE': 'Image is too blurry or dark. Please try better lighting or use text input.'
      };
      throw new Error(errorMessages[parsed.errorType] || 'Unable to recognize ingredients from image.');
    }

    // Validate success response
    if (!parsed.ingredients || !Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      throw new Error('No food items detected in this image. Please try another photo or use text input.');
    }

    console.log('[aiService] Recognized ingredients:', parsed.ingredients);
    return parsed.ingredients;

  } catch (error) {
    console.error('[aiService] Food recognition error:', error);

    // Pass through validation errors
    if (error.message?.includes('No food') || error.message?.includes('too blurry')) {
      throw error;
    }

    // Handle API errors
    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key not configured. Please check your .env file.');
    }
    if (error.message?.includes('rate limit')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    throw new Error('Unable to recognize ingredients. Please try text input instead.');
  }
};

/**
 * Validate ingredients are actual food items
 * @param {string[]} ingredients - Array of ingredient names
 * @returns {Promise<boolean>} True if valid food ingredients
 * @throws {Error} If validation fails or inputs are not food
 */
const validateFoodIngredients = async (ingredients) => {
  const ingredientsList = ingredients.join(', ');

  try {
    console.log('[aiService] Validating ingredients:', ingredientsList);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a food validation AI. Determine if provided text contains actual food ingredients.

VALIDATION RULES:
1. Check if ALL items in the list are recognizable food ingredients
2. Accept common foods, produce, meats, seasonings, packaged foods
3. Accept misspellings if intent is clear (e.g., "chiken" → chicken is OK)
4. REJECT nonsense words, random characters, non-food items
5. REJECT if majority of items are not food (e.g., "apple, zhxcvb, qwerty" → REJECT)

IMPORTANT: Return your response in JSON format with the following structure:
{
  "isValid": true | false,
  "reason": "Brief explanation if invalid"
}

Examples:
- "chicken, broccoli, garlic" → {"isValid": true}
- "apple, banana, orange" → {"isValid": true}
- "chiken, brocoli" (misspelled but clear) → {"isValid": true}
- "zhahcjsf, qwerty, asdfgh" → {"isValid": false, "reason": "These appear to be random characters, not food ingredients."}
- "car, table, phone" → {"isValid": false, "reason": "These are objects, not food ingredients."}
- "apple, zhxcvb, carrot" → {"isValid": false, "reason": "List contains non-food items mixed with food."}`
        },
        {
          role: 'user',
          content: `Validate if these are food ingredients: ${ingredientsList}`
        }
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    console.log('[aiService] Ingredient validation result:', parsed);

    if (!parsed.isValid) {
      throw new Error(parsed.reason || 'Please enter actual food ingredients. Examples: chicken, rice, vegetables, etc.');
    }

    return true;

  } catch (error) {
    console.error('[aiService] Ingredient validation error:', error);

    // Pass through validation errors
    if (error.message?.includes('food ingredients')) {
      throw error;
    }

    throw new Error('Unable to validate ingredients. Please check your input and try again.');
  }
};;

/**
 * Chef iQ Smart Cooking Equipment Data
 * Used for Phase 16: AI Inspiration with Chef iQ Integration
 *
 * Updated to use actual product images instead of emojis for professional appearance
 */
export const CHEF_IQ_EQUIPMENT = {
  'iQ Cooker': {
    name: 'iQ Cooker',
    url: 'https://chefiq.com/products/iq-cooker',
    description: 'Smart pressure cooker with guided cooking',
    image: require('../../assets/chefiq_products/iq-cooker.png'),
    imageAlt: 'Chef iQ Smart Pressure Cooker with digital display and pressure release valve',
    features: ['Precision pressure control', 'Guided cooking modes', 'Auto steam release']
  },
  'iQ Sense': {
    name: 'iQ Sense',
    url: 'https://chefiq.com/products/iq-sense',
    description: 'Smart thermometer for precise temperature control',
    image: require('../../assets/chefiq_products/iq-sense.png'),
    imageAlt: 'Chef iQ Smart Cooking Thermometer with wireless probe and charging case',
    features: ['Wireless temperature monitoring', 'Multiple probe support', 'Real-time alerts']
  },
  'iQ MiniOven': {
    name: 'iQ MiniOven',
    url: 'https://chefiq.com/products/iq-minioven',
    description: 'Smart countertop oven with air fry',
    image: require('../../assets/chefiq_products/iq-minioven.png'),
    imageAlt: 'Chef iQ Smart Countertop Oven with touchscreen and viewing window',
    features: ['12 cooking modes', 'Air fry technology', 'Precision temperature control']
  }
};

/**
 * Generate recipe ideas based on ingredients using GPT-4o
 * CRITICAL REQUIREMENT: Exactly 1 of 3 recipes MUST include Chef iQ equipment
 * @param {string[]} ingredients - Array of ingredient names
 * @param {string[]} cuisines - Array of cuisine preferences
 * @returns {Promise<Object[]>} Array of 3 recipe suggestions (1 with Chef iQ)
 * @throws {Error} If API call fails or generation fails
 */
export const generateRecipeIdeas = async (ingredients, cuisines) => {
  if (!ingredients || ingredients.length === 0) {
    throw new Error('Please provide at least one ingredient');
  }
  if (!cuisines || cuisines.length === 0) {
    throw new Error('Please select at least one cuisine');
  }

  // NEW: Validate ingredients before generating recipes
  await validateFoodIngredients(ingredients);

  try {
    console.log('[aiService] Generating recipe ideas...');
    console.log('[aiService] Ingredients:', ingredients);
    console.log('[aiService] Cuisines:', cuisines);

    const ingredientsList = ingredients.join(', ');
    const cuisinesList = cuisines.join(', ');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative chef AI that generates unique recipe ideas based on ingredients and cuisine preferences.

CRITICAL REQUIREMENT:
- Generate EXACTLY 3 unique recipes
- EXACTLY 1 recipe (randomly selected) MUST use Chef iQ smart cooking equipment
- Choose from: iQ Cooker (pressure cooker), iQ Sense (smart thermometer), or iQ MiniOven (smart oven)
- Include specific cooking instructions for the Chef iQ equipment
- The other 2 recipes should use standard cooking methods

For the Chef iQ recipe:
- equipment: Include the Chef iQ device name as first item in array (e.g., ["iQ Cooker", "other equipment"])
- Include temperature/time settings specific to Chef iQ device
- Add a cooking step that mentions: "Use Chef iQ [device name] set to [temp/pressure/mode]"
- Set chefIQRequired: true

REQUIRED JSON FORMAT - Return EXACTLY this structure:
{
  "recipes": [
    {
      "title": "string (max 80 chars)",
      "description": "string (max 200 chars, appetizing description)",
      "cuisine": "string (from user's selected cuisines)",
      "difficulty": "Easy" | "Medium" | "Hard",
      "cookingTime": number (minutes),
      "equipment": ["string"] (Chef iQ device FIRST if applicable),
      "ingredients": [{"name": "string", "amount": "string"}],
      "steps": [{"number": number, "description": "string"}],
      "chefIQRequired": boolean (true for exactly 1 recipe)
    },
    ... two more recipes
  ]
}

CRITICAL: You MUST return an object with a "recipes" key containing an array of EXACTLY 3 recipes. Do NOT return a single recipe or a bare array.

Make recipes creative, practical, and delicious. Use the provided ingredients prominently.`
        },
        {
          role: 'user',
          content: `Generate 3 unique recipe ideas using these ingredients: ${ingredientsList}

Cuisine preferences: ${cuisinesList}

IMPORTANT: Return your response in this exact format:
{
  "recipes": [
    {recipe1},
    {recipe2},
    {recipe3}
  ]
}

Remember: EXACTLY 1 recipe must use Chef iQ equipment (iQ Cooker, iQ Sense, or iQ MiniOven).`
        }
      ],
      temperature: 0.8, // Higher temperature for creative recipe generation
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log('[aiService] Raw recipe generation response:', content);

    const parsed = JSON.parse(content);
    console.log('[aiService] Parsed recipes:', parsed);

    // Extract recipes array (GPT may wrap in {recipes: []} or return array directly)
    const recipes = parsed.recipes || parsed;

    if (!Array.isArray(recipes) || recipes.length !== 3) {
      throw new Error('Invalid response: Expected array of 3 recipes');
    }

    // Validate that exactly 1 recipe has Chef iQ
    const chefIQCount = recipes.filter(r => r.chefIQRequired === true).length;
    if (chefIQCount !== 1) {
      console.warn(`[aiService] Chef iQ requirement violated: ${chefIQCount} recipes have chefIQRequired=true`);
      // Force exactly 1 recipe to have Chef iQ (fallback safety)
      recipes.forEach((r, idx) => {
        r.chefIQRequired = idx === 0; // Set first recipe as Chef iQ
      });
      if (!recipes[0].equipment || recipes[0].equipment.length === 0) {
        recipes[0].equipment = ['iQ Cooker'];
      } else if (!recipes[0].equipment[0].startsWith('iQ')) {
        recipes[0].equipment.unshift('iQ Cooker');
      }
    }

    console.log('[aiService] Generated recipes (validated):', recipes);
    return recipes;

  } catch (error) {
    console.error('[aiService] Recipe generation error:', error);

    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key not configured. Please check your .env file.');
    }
    if (error.message?.includes('rate limit') || error.status === 429) {
      throw new Error('Too many requests. Please wait 1 minute and try again.');
    }
    if (error.message?.includes('timeout')) {
      throw new Error('AI is taking too long. Try again with fewer ingredients.');
    }
    if (error.message?.includes('Invalid response')) {
      throw error;
    }

    throw new Error('Unable to generate recipes. Please try again or adjust your inputs.');
  }
};

/**
 * Generate recipe image using GPT-4o Image Generation API with automatic retry
 * Cost: ~$0.02 per image (1024×1024 resolution)
 * @param {string} recipeTitle - Recipe title for image prompt
 * @param {string} recipeDescription - Recipe description for context
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<string>} Generated image URL
 * @throws {Error} If image generation fails after all retries
 */
export const generateRecipeImage = async (recipeTitle, recipeDescription, maxRetries = 3) => {
  if (!recipeTitle) {
    throw new Error('Recipe title is required for image generation');
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[aiService] Generating recipe image for: ${recipeTitle} (attempt ${attempt}/${maxRetries})`);

      const prompt = `Professional food photography of ${recipeTitle}, beautifully plated, natural lighting, on white ceramic plate, high resolution, appetizing presentation. ${recipeDescription}`;

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard', // 'standard' is cheaper than 'hd'
        style: 'natural' // Natural style for food photography
      });

      const imageUrl = response.data[0].url;
      console.log('[aiService] Image generated successfully:', imageUrl);

      return imageUrl;

    } catch (error) {
      lastError = error;

      // Don't retry for non-retryable errors
      if (error.message?.includes('API key')) {
        throw new Error('OpenAI API key not configured. Please check your .env file.');
      }
      if (error.message?.includes('content_policy')) {
        throw new Error('Recipe title violates content policy. Please use a different title.');
      }

      // For retryable errors (500, timeout, rate limit), log as info and retry
      if (attempt < maxRetries) {
        console.log(`[aiService] Image generation attempt ${attempt}/${maxRetries} failed (retrying):`, error.message);
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`[aiService] Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Only log as error on final attempt
        console.error(`[aiService] Image generation error (attempt ${attempt}/${maxRetries}):`, error);
      }
    }
  }

  // All retries failed
  console.error('[aiService] Image generation failed after all retries:', lastError);

  if (lastError.message?.includes('rate limit') || lastError.status === 429) {
    throw new Error('Too many image requests. Please wait and try again.');
  }

  throw new Error('Unable to generate image. You can still save the recipe and add a photo later.');
};

export default {
  parseRecipeText,
  parseRecipeImage,
  recognizeIngredientsFromImage,
  generateRecipeIdeas,
  generateRecipeImage,
  CHEF_IQ_EQUIPMENT
};
