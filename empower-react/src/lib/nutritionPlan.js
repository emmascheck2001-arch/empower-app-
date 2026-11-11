const PHASE_FOCUS = {
  Menstrual: 'regular meals with iron-containing foods and vitamin-C-rich produce',
  Follicular: 'a balanced meal foundation matched to your hunger and activity',
  Ovulatory: 'a balanced meal foundation matched to your hunger and activity',
  Luteal: 'regular meals, protein, fibre, and satisfying carbohydrates',
  Perimenopause: 'protein, calcium-containing foods, fibre, and colourful produce',
  observation: 'balanced meals and consistent protein',
}

// Research traceability for every phase. The plan deliberately distinguishes a supported
// food-context adjustment from a claimed treatment. In particular, reviews find no consensus
// for special food rules in the follicular or ovulatory phases, so those meals use the same
// balanced foundation instead of inventing hormone-specific effects.
const SOURCE = {
  menstrualReview: { citation: 'Brown et al., 2024 · Nutritional practices to manage menstrual-cycle symptoms: systematic review', url: 'https://pubmed.ncbi.nlm.nih.gov/37746736/' },
  vitaminCIron: { citation: 'Cook & Reddy, 2001 · Vitamin C and non-heme iron absorption from a complete diet', url: 'https://pubmed.ncbi.nlm.nih.gov/11124756/' },
  phaseEnergyReview: { citation: 'Tucker et al., 2025 · Menstrual cycle energy intake: systematic review and meta-analysis', url: 'https://pubmed.ncbi.nlm.nih.gov/39008822/' },
  phaseEnergyNarrative: { citation: '2023 · Dietary energy intake across the menstrual cycle: review', url: 'https://pubmed.ncbi.nlm.nih.gov/36367830/' },
  menopauseReview: { citation: 'Baraut, 2026 · Nutrition during the menopausal transition: clinical review', url: 'https://pubmed.ncbi.nlm.nih.gov/42303129/' },
  menopauseDietReview: { citation: 'Liu & Guo, 2025 · Dietary strategies for menopausal health: evidence review', url: 'https://pubmed.ncbi.nlm.nih.gov/41473185/' },
}

const LUTEAL_STUDIES = [
  { citation: 'Gong, Garrel & Calloway, 1989 · American Journal of Clinical Nutrition', url: 'https://pubmed.ncbi.nlm.nih.gov/2916445/' },
  { citation: 'Barr, Janelle & Prior, 1995 · American Journal of Clinical Nutrition', url: 'https://pubmed.ncbi.nlm.nih.gov/7825535/' },
  { citation: 'Martini et al., 1994 · American Journal of Clinical Nutrition', url: 'https://pubmed.ncbi.nlm.nih.gov/7985630/' },
  { citation: 'Chung, Bond & Jarrett, 2010 · Biological Research for Nursing', url: 'https://pubmed.ncbi.nlm.nih.gov/20453021/' },
]

export const PHASE_MEAL_EVIDENCE = {
  Menstrual: {
    claim: 'The plan includes iron-containing foods with vitamin-C-rich produce as a practical meal pairing; it does not diagnose or treat iron deficiency.',
    sources: [SOURCE.menstrualReview, SOURCE.vitaminCIron],
  },
  Follicular: {
    claim: 'There is no supported special-food rule for this phase, so the plan stays balanced and adapts to appetite and activity.',
    sources: [SOURCE.phaseEnergyReview, SOURCE.phaseEnergyNarrative],
  },
  Ovulatory: {
    claim: 'There is no supported special-food rule for this phase, so the plan stays balanced and adapts to appetite and activity.',
    sources: [SOURCE.phaseEnergyReview, SOURCE.phaseEnergyNarrative],
  },
  Luteal: {
    claim: 'Four peer-reviewed studies observed higher average energy intake in the luteal than follicular phase; the plan therefore makes room for an optional satisfying snack, never a fixed calorie prescription.',
    sources: LUTEAL_STUDIES,
    review: SOURCE.phaseEnergyReview,
  },
  Perimenopause: {
    claim: 'The plan prioritises overall dietary quality, protein and calcium-containing foods for general cardiometabolic, muscle and bone support—not as a universal treatment for symptoms.',
    sources: [SOURCE.menopauseReview, SOURCE.menopauseDietReview],
  },
  observation: {
    claim: 'The plan uses a balanced-food foundation while individual symptom and cycle patterns are still being learned.',
    sources: [SOURCE.menstrualReview, SOURCE.phaseEnergyReview],
  },
}

function dietMode(diets = []) {
  if (diets.includes('vegan')) return 'vegan'
  if (diets.includes('vegetarian')) return 'vegetarian'
  if (diets.includes('pescatarian')) return 'pescatarian'
  return 'standard'
}

const PROTEINS = {
  standard: ['chicken', 'salmon', 'Greek yogurt'],
  pescatarian: ['salmon', 'tinned salmon or sardines', 'Greek yogurt'],
  vegetarian: ['eggs', 'lentils or chickpeas', 'Greek yogurt'],
  vegan: ['chickpeas', 'lentils', 'pea-protein yogurt'],
}

function proteinOptions(diets) {
  const proteins = [...PROTEINS[dietMode(diets)]]
  if (diets.includes('dairy_free')) proteins[2] = 'coconut or pea-protein yogurt'
  return proteins
}

const ROTATIONS = [
  {
    breakfast: { title: 'Protein oats', detail: p => `Oats with berries, ${p[2]}, and pumpkin seeds.`, swaps: p => [`Overnight oats with ${p[2]}`, 'Eggs on toast with fruit'] },
    lunch: { title: 'Colourful grain bowl', detail: p => `Quinoa, roasted vegetables, ${p[0]}, and a lemon-tahini dressing.`, swaps: p => [`Brown-rice bowl with ${p[1]}`, 'Big salad with chickpeas, seeds, and olive oil'] },
    dinner: { title: 'Sheet-pan dinner', detail: p => `${p[1]}, sweet potato, and broccoli roasted together.`, swaps: p => [`Stir-fry with ${p[0]}, vegetables, and rice`, 'Lentil tomato pasta or gluten-free pasta'] },
    snack: 'Fruit with nuts or seeds', grocery: ['oats', 'berries', 'pumpkin seeds', 'quinoa', 'roasting vegetables', 'sweet potato', 'broccoli', 'fruit', 'nuts or seeds'],
  },
  {
    breakfast: { title: 'Eggs, toast, and fruit', detail: () => 'Scrambled or fried eggs with spinach, peppers, and potatoes or toast.', swaps: () => ['Protein smoothie with fruit and milk or a dairy-free alternative', 'Chia pudding with berries and nuts'] },
    lunch: { title: 'Hearty soup and salad', detail: p => `Lentil-vegetable soup with a side salad and ${p[2]}.`, swaps: p => [`Tuna or chickpea wrap with crunchy vegetables`, `Leftover grain bowl with ${p[0]}`] },
    dinner: { title: 'Simple curry', detail: p => `Chickpea and vegetable curry with rice; add ${p[0]} if you want more protein.`, swaps: p => [`Taco bowl with beans, rice, avocado, and ${p[1]}`, 'Baked potato topped with beans, greens, and yogurt or soy yogurt'] },
    snack: 'Veggies with hummus', grocery: ['eggs', 'spinach', 'peppers', 'potatoes', 'lentils', 'salad vegetables', 'chickpeas', 'curry sauce or spices', 'rice', 'hummus'],
  },
  {
    breakfast: { title: 'Yogurt and fruit bowl', detail: () => 'With fruit, chia seeds, and a handful of oats or granola.', swaps: () => ['Warm oats with nut butter and banana', 'Breakfast quesadilla with eggs and greens'] },
    lunch: { title: 'Mediterranean plate', detail: p => `Hummus, cucumber, tomatoes, olives, whole grains or rice, and ${p[0]}.`, swaps: p => [`Bean salad with avocado and ${p[1]}`, 'Leftover curry or soup'] },
    dinner: { title: 'Pasta or rice skillet', detail: p => `Tomato sauce, greens, mushrooms, and ${p[1]}; use whole-grain or gluten-free pasta.`, swaps: p => [`Baked salmon or chicken with rice and green beans`, `Chili with beans and ${p[0]}`] },
    snack: 'Dark chocolate with fruit or yogurt', grocery: ['Greek yogurt or soy yogurt', 'fruit', 'chia seeds', 'hummus', 'cucumber', 'tomatoes', 'greens', 'mushrooms', 'tomato sauce', 'dark chocolate'],
  },
]

// These are food ideas, not phase-specific prescriptions. Menstrual meals make the iron +
// vitamin-C pairing easy; luteal meals make a satisfying optional snack easy; perimenopause
// meals deliberately include protein and calcium-containing options. Follicular and ovulatory
// meals differ for variety, not because a particular food has been proven to alter hormones.
const PHASE_ROTATIONS = {
  Menstrual: [
    {
      breakfast: { title: 'Spinach eggs with berries', detail: () => 'Eggs with spinach and peppers, plus berries or an orange.', swaps: p => [`Iron-fortified cereal with ${p[2]} and strawberries`, 'Oats with pumpkin seeds, berries, and nut butter'] },
      lunch: { title: 'Lentil and pepper soup', detail: () => 'Lentil-vegetable soup with bell peppers or citrus fruit on the side.', swaps: p => [`Bean and tomato salad with ${p[0]}`, 'Chickpea wrap with crunchy peppers and fruit'] },
      dinner: { title: 'Tomato bean skillet', detail: p => `${p[0]} or beans with tomatoes, greens, potatoes or rice, and a squeeze of lemon.`, swaps: p => [`${p[1]} with sweet potato and broccoli`, 'Lentil pasta with tomato sauce and greens'] },
      snack: 'Fruit with pumpkin seeds', grocery: ['eggs', 'spinach', 'peppers', 'berries or oranges', 'lentils', 'tomatoes', 'beans', 'greens', 'lemon', 'pumpkin seeds'],
    },
    {
      breakfast: { title: 'Oats, seeds, and citrus', detail: p => `Oats with ${p[2]}, pumpkin seeds, and kiwi, berries, or orange.`, swaps: () => ['Eggs on toast with peppers and fruit', 'Chia pudding with berries and nut butter'] },
      lunch: { title: 'Chickpea citrus grain bowl', detail: () => 'Chickpeas, brown rice or quinoa, greens, peppers, and a lemon-tahini dressing.', swaps: p => [`Tuna or bean salad with citrus and ${p[2]}`, 'Lentil soup with whole-grain toast'] },
      dinner: { title: 'Sheet-pan protein and vegetables', detail: p => `${p[1]}, potatoes, broccoli, and peppers roasted together.`, swaps: p => [`Bean chili with ${p[0]}`, 'Tofu or chicken stir-fry with rice and greens'] },
      snack: 'Orange with nuts or seeds', grocery: ['oats', 'yogurt or alternative', 'pumpkin seeds', 'citrus fruit', 'chickpeas', 'rice or quinoa', 'greens', 'peppers', 'potatoes', 'broccoli'],
    },
  ],
  Follicular: [
    {
      breakfast: { title: 'Protein oats and fruit', detail: p => `Oats with berries, ${p[2]}, and nuts or seeds.`, swaps: () => ['Eggs on toast with fruit', 'Smoothie with fruit and a protein source'] },
      lunch: { title: 'Colourful grain bowl', detail: p => `Quinoa or brown rice, roasted vegetables, ${p[0]}, and a lemon-tahini dressing.`, swaps: p => [`Bean salad with avocado and ${p[1]}`, 'Hummus, vegetables, and whole-grain pita'] },
      dinner: { title: 'Vegetable stir-fry and rice', detail: p => `${p[1]} or ${p[0]} with mixed vegetables and rice.`, swaps: () => ['Lentil tomato pasta with greens', 'Taco bowl with beans, rice, and avocado'] },
      snack: 'Fruit with nuts or seeds', grocery: ['oats', 'berries', 'yogurt or alternative', 'quinoa or brown rice', 'roasting vegetables', 'tahini', 'rice', 'mixed vegetables', 'fruit', 'nuts or seeds'],
    },
    {
      breakfast: { title: 'Eggs, toast, and fruit', detail: () => 'Eggs with toast, spinach, and fruit.', swaps: () => ['Yogurt or soy-yogurt bowl with oats and berries', 'Chia pudding with banana and nut butter'] },
      lunch: { title: 'Crunchy wrap and salad', detail: p => `${p[0]} or chickpeas in a whole-grain wrap with crunchy vegetables and a side salad.`, swaps: () => ['Leftover grain bowl', 'Lentil-vegetable soup with toast'] },
      dinner: { title: 'Salmon or tofu tray bake', detail: p => `${p[1]}, potatoes, green beans, and a yogurt or tahini sauce.`, swaps: p => [`${p[0]} pasta with tomato sauce and mushrooms`, 'Chickpea curry with rice'] },
      snack: 'Yogurt or soy yogurt with fruit', grocery: ['eggs', 'whole-grain toast or wraps', 'spinach', 'fruit', 'salad vegetables', 'potatoes', 'green beans', 'yogurt or alternative', 'chickpeas', 'rice'],
    },
  ],
  Ovulatory: [
    {
      breakfast: { title: 'Yogurt, oats, and fruit bowl', detail: p => `${p[2]} with oats or granola, fruit, chia seeds, and nuts.`, swaps: () => ['Eggs on toast with fruit', 'Warm oats with banana and nut butter'] },
      lunch: { title: 'Quinoa salad plate', detail: p => `Quinoa, cucumber, tomatoes, greens, beans or ${p[1]}, and olive oil-lemon dressing.`, swaps: p => [`Whole-grain wrap with ${p[0]} or chickpeas`, 'Hummus plate with vegetables and pita'] },
      dinner: { title: 'Taco bowl with vegetables', detail: p => `${p[0]} or beans, rice, peppers, greens, salsa, and avocado.`, swaps: p => [`${p[1]} with potatoes and broccoli`, 'Lentil pasta with greens'] },
      snack: 'Fruit with nuts or hummus', grocery: ['yogurt or alternative', 'oats', 'fruit', 'chia seeds', 'quinoa', 'cucumber', 'tomatoes', 'greens', 'beans', 'rice', 'peppers', 'avocado'],
    },
    {
      breakfast: { title: 'Egg and avocado toast', detail: () => 'Eggs, avocado, toast, and a side of fruit.', swaps: () => ['Yogurt or soy yogurt with fruit and seeds', 'Oats with nut butter and banana'] },
      lunch: { title: 'Mediterranean bean bowl', detail: p => `White beans or ${p[1]}, vegetables, olives, whole grains, and a lemon-herb dressing.`, swaps: p => [`${p[0]} or tofu salad wrap`, 'Leftover rice bowl with chickpeas'] },
      dinner: { title: 'Simple pasta and greens', detail: p => `Tomato sauce, mushrooms, greens, and ${p[0]} or lentils with pasta or rice.`, swaps: p => [`${p[1]} with rice and green beans`, 'Vegetable curry with chickpeas'] },
      snack: 'Vegetables with hummus', grocery: ['eggs', 'avocado', 'whole-grain toast', 'fruit', 'white beans', 'olives', 'whole grains', 'tomato sauce', 'mushrooms', 'greens', 'hummus'],
    },
  ],
  Luteal: [
    {
      breakfast: { title: 'Banana protein oats', detail: p => `Warm oats with banana, nut butter, ${p[2]}, and cinnamon.`, swaps: () => ['Eggs on toast with avocado and fruit', 'Yogurt or soy yogurt with berries and granola'] },
      lunch: { title: 'Lentil soup and toast', detail: () => 'Lentil-vegetable soup with whole-grain toast and a side salad.', swaps: p => [`Brown-rice bowl with beans and ${p[0]}`, 'Chickpea wrap with vegetables and hummus'] },
      dinner: { title: 'Bean chili with sweet potato', detail: p => `Bean and vegetable chili over a baked sweet potato; add ${p[0]} if you want more protein.`, swaps: p => [`${p[1]} with rice and broccoli`, 'Lentil tomato pasta with greens'] },
      snack: 'Satisfying snack pair', grocery: ['oats', 'bananas', 'nut butter', 'yogurt or alternative', 'lentils', 'whole-grain toast', 'beans', 'sweet potatoes', 'broccoli', 'fruit'],
    },
    {
      breakfast: { title: 'Eggs, avocado, and toast', detail: () => 'Eggs with avocado, spinach, toast, and fruit.', swaps: () => ['Overnight oats with fruit and nut butter', 'Yogurt or soy yogurt with oats and seeds'] },
      lunch: { title: 'Protein rice bowl', detail: p => `Brown rice, roasted vegetables, ${p[0]}, beans, and tahini or avocado.`, swaps: p => [`Lentil salad with ${p[2]}`, 'Chickpea curry with rice'] },
      dinner: { title: 'Pasta, greens, and protein', detail: p => `Whole-grain or gluten-free pasta with tomato sauce, greens, and ${p[1]} or lentils.`, swaps: p => [`${p[0]} stir-fry with vegetables and rice`, 'Baked potato with beans, greens, and yogurt or soy yogurt'] },
      snack: 'Satisfying snack pair', grocery: ['eggs', 'avocado', 'spinach', 'whole-grain toast', 'fruit', 'brown rice', 'roasting vegetables', 'beans', 'tahini', 'pasta', 'tomato sauce', 'greens'],
    },
  ],
  Perimenopause: [
    {
      breakfast: { title: 'Calcium-rich overnight oats', detail: p => `Oats with ${p[2]}, berries, chia seeds, and nuts.`, swaps: () => ['Eggs with greens and toast', 'Calcium-set tofu scramble with vegetables'] },
      lunch: { title: 'Protein and grain bowl', detail: p => `${p[0]} or calcium-set tofu with quinoa, greens, beans, and lemon-tahini.`, swaps: () => ['Lentil-vegetable soup with whole-grain toast', 'Chickpea salad with avocado and seeds'] },
      dinner: { title: 'Broccoli potato tray bake', detail: p => `${p[1]}, potatoes, broccoli, and peppers roasted together.`, swaps: p => [`${p[0]} and vegetable stir-fry with rice`, 'Bean chili with greens and yogurt or soy yogurt'] },
      snack: 'Yogurt or fortified alternative with fruit', grocery: ['oats', 'yogurt or fortified alternative', 'berries', 'chia seeds', 'quinoa', 'greens', 'beans', 'potatoes', 'broccoli', 'peppers', 'fruit'],
    },
    {
      breakfast: { title: 'Eggs, greens, and fruit', detail: () => 'Eggs with greens, toast, and fruit.', swaps: () => ['Yogurt or fortified soy-yogurt bowl with oats', 'Tofu scramble with vegetables'] },
      lunch: { title: 'White bean vegetable soup', detail: p => `White beans, vegetables, whole grains, and ${p[2]} or a fortified alternative on the side.`, swaps: p => [`${p[0]} salad with seeds and avocado`, 'Hummus plate with vegetables and whole-grain pita'] },
      dinner: { title: 'Tomato lentil pasta', detail: p => `Lentils, tomato sauce, greens, and ${p[1]} or calcium-set tofu with pasta.`, swaps: p => [`${p[0]} with rice and green vegetables`, 'Baked potato with beans and yogurt or soy yogurt'] },
      snack: 'Fruit with yogurt or nuts', grocery: ['eggs', 'greens', 'fruit', 'whole-grain toast', 'white beans', 'soup vegetables', 'fortified yogurt or alternative', 'lentils', 'tomato sauce', 'pasta', 'nuts'],
    },
  ],
}

export function buildTodayFoodPlan(phase = 'observation', diets = [], seed = 0) {
  const rotations = PHASE_ROTATIONS[phase] || ROTATIONS
  const rotation = rotations[Math.abs(seed) % rotations.length]
  const proteins = proteinOptions(diets)
  const meal = (id, label, source) => ({
    id, label, title: source.title, detail: source.detail(proteins), swaps: source.swaps(proteins),
  })
  const snack = phase === 'Luteal'
    ? {
        id: 'snack', label: 'Snack', title: 'Satisfying snack pair',
        detail: `If you are hungry, pair fruit or whole-grain crackers with ${proteins[2]}, nut butter, or hummus.`,
        swaps: ['Apple or banana with nut butter', 'Hummus with pita and crunchy vegetables', `${proteins[2]} with fruit, oats, or seeds`],
      }
    : {
        id: 'snack', label: 'Snack', title: rotation.snack,
        detail: 'Choose an option that suits your hunger and schedule.',
        swaps: ['Fruit with nut butter', 'Yogurt or soy yogurt with seeds'],
      }
  return {
    focus: PHASE_FOCUS[phase] || PHASE_FOCUS.observation,
    meals: [meal('breakfast', 'Breakfast', rotation.breakfast), meal('lunch', 'Lunch', rotation.lunch), meal('dinner', 'Dinner', rotation.dinner), snack],
    groceries: rotation.grocery,
    evidence: PHASE_MEAL_EVIDENCE[phase] || PHASE_MEAL_EVIDENCE.observation,
  }
}
