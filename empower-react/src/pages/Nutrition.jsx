// route /nutrition, phase-aware food guidance, protein targets, symptom relief accordion, diet preference
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import Spinner from '../components/Spinner'

const PHASE_GRADIENT = {
  Menstrual:      'linear-gradient(135deg, #3d2830, #2c1f25)',
  Follicular:     'linear-gradient(135deg, #2c3828, #1f2c20)',
  Ovulatory:      'linear-gradient(135deg, #2c3035, #1f252c)',
  Luteal:         'linear-gradient(135deg, #352c20, #2c2415)',
  'Early luteal': 'linear-gradient(135deg, #352c20, #2c2415)',
  'Mid luteal':   'linear-gradient(135deg, #352c20, #2c2415)',
  'Late luteal':  'linear-gradient(135deg, #352c20, #2c2415)',
  Perimenopause:  'linear-gradient(135deg, #2c2835, #1f1e2c)',
  observation:    'linear-gradient(135deg, #2c2820, #1f1e18)',
}

const PHASE_DATA = {
  Menstrual: {
    desc: 'Iron and anti-inflammatory focus',
    science: 'Iron lost through bleeding affects performance and energy. Vitamin C consumed with iron-rich meals improves absorption by up to 67%.',
    sectionLabel: 'Foods to prioritise this week',
    foods: [
      { icon:'🥩', name:'Red meat, beans, or lentils', why:'Red meat has the most absorbable iron; beans and lentils are an excellent, affordable plant-based source. Pair plant iron with a squeeze of citrus to boost absorption. Either way, you are replacing iron lost during bleeding.' },
      { icon:'🥬', name:'Leafy greens with citrus', why:'Spinach and kale provide plant-based iron and folate. Pairing with vitamin C from citrus or bell pepper can triple how much iron your body absorbs.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 fatty acids lower prostaglandins, the pain-causing hormones that drive cramping, and may modestly reduce period pain when eaten consistently (Rahbar et al. 2012). Best used alongside your usual pain relief, not as a replacement.' },
      { icon:'🟤', name:'Dark chocolate (70%+)', why:'A rich source of magnesium, which relaxes smooth muscle including the uterus and may reduce cramping severity.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'High in magnesium and zinc, both of which are depleted during menstruation and support muscle function.' },
      { icon:'🫚', name:'Ginger', why:'Gingerols and shogaols are natural anti-inflammatories. One randomized trial found ginger eased period pain about as well as ibuprofen on day one (Ozgoli 2009); evidence is still limited, so use it alongside your usual pain relief, not instead.' },
    ],
    avoid: [
      'Black tea and coffee within one hour of iron-rich meals, which reduce absorption significantly',
      'Trans fats, which increase prostaglandins, the pain-causing hormones behind cramps',
      'High-sodium foods, which worsen bloating and water retention',
      'Excess alcohol, which disrupts sleep quality and amplifies inflammation',
    ],
    carbCravings: true,
  },
  Follicular: {
    desc: 'Lean protein and complex carbohydrates',
    science: 'Rising estrogen directly improves how well your body uses carbohydrates and builds muscle. This is the most efficient phase of your cycle for both energy and strength gains.',
    sectionLabel: 'Foods to build on this week',
    foods: [
      { icon:'🥚', name:'Eggs', why:'Complete protein containing all essential amino acids. Choline in yolks also supports neurotransmitter production as estrogen rises.' },
      { icon:'🐔', name:'Chicken or turkey', why:'Lean complete protein to support muscle protein synthesis alongside rising estrogen.' },
      { icon:'🫐', name:'Blueberries and mixed berries', why:'Antioxidants reduce oxidative stress from increasing training load and support gut health for hormone clearance.' },
      { icon:'🥑', name:'Avocado', why:'Healthy monounsaturated fats support estrogen production and absorption of fat-soluble vitamins.' },
      { icon:'🌾', name:'Oats and sweet potato', why:'Complex carbohydrates maintain stable energy. Enhanced carbohydrate utilisation in this phase due to estrogen\'s effect on insulin sensitivity.' },
      { icon:'🥦', name:'Broccoli and cauliflower', why:'Cruciferous vegetables contain a compound that research suggests may support healthy estrogen metabolism and clearance.' },
    ],
    avoid: [
      'Ultra-processed foods, which blunt the rising insulin sensitivity this phase provides',
      'Excess alcohol, which disrupts estrogen metabolism and liver clearance',
    ],
  },
  Ovulatory: {
    desc: 'Light and energising foods',
    science: 'Peak estrogen and a brief testosterone rise create the highest energy and performance window of the cycle. Digestive load has a measurable effect on peak output, so lighter meals before training pay off.',
    sectionLabel: 'Foods that match your energy',
    foods: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 fatty acids and complete protein to support peak training performance and recovery.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at higher training intensity.' },
      { icon:'🥗', name:'Quinoa', why:'A complete plant protein with complex carbohydrates, light enough to eat before peak training without digestive drag.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 and healthy fats that support your hormonal environment at peak estrogen.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at high training intensity.' },
      { icon:'🥒', name:'Cucumber and hydrating vegetables', why:'Micronutrients and hydration without adding digestive load before peak sessions.' },
    ],
    avoid: [
      'Very heavy meals before peak training, which reduce performance output',
      'Excess caffeine, which may amplify cortisol that is naturally higher at peak intensity',
    ],
  },
  Luteal: {
    desc: 'Protein-forward with complex carbohydrates',
    science: 'Progesterone causes your body to break down muscle protein faster than in other phases. This means protein requirements are at their highest point in the luteal phase.',
    sectionLabel: 'Foods to prioritise this phase',
    foods: [
      { icon:'🥩', name:'Red meat or tofu', why:'Protein requirements are highest in the luteal phase. Progesterone causes your body to break down muscle protein faster, so consistent intake throughout the day is a priority.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates help stabilise serotonin, which drops progressively through the luteal phase and drives mood changes.' },
      { icon:'🥬', name:'Leafy greens with eggs', why:'Calcium and vitamin B6 are both cofactors for serotonin and dopamine synthesis, which become less stable as progesterone rises.' },
      { icon:'🍫', name:'Dark chocolate', why:'Magnesium supports mood, muscle relaxation, and sleep. Carbohydrate cravings in this phase are driven by serotonin demand, and dark chocolate partially addresses both.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Reduces inflammation and supports mood in the second half of your cycle. The omega-3 DHA specifically supports brain function and neurotransmitter balance.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and soluble fibre for stable blood sugar and sustained energy when energy fluctuates most.' },
    ],
    avoid: [
      'Alcohol, which amplifies mood instability and significantly disrupts sleep architecture in the luteal phase',
      'Refined sugar, which worsens blood sugar swings and inflammation when both are already elevated',
      'High-sodium foods, which worsen luteal-phase bloating',
      'Excess caffeine, which raises cortisol that already competes with progesterone in your stress hormone system during this phase',
    ],
  },
  Perimenopause: {
    desc: 'Protein and bone-protective nutrition',
    science: 'As estrogen declines, the body tends to store more fat around the abdomen and becomes less responsive to insulin. Protein needs are higher during this transition to support muscle maintenance.',
    sectionLabel: 'Foods that support your transition',
    foods: [
      { icon:'🦴', name:'Calcium-rich foods', why:'Calcium and vitamin D matter more as estrogen falls and bone turnover accelerates. Good sources include dairy, fortified plant milks, calcium-set tofu, tinned sardines with bones, and leafy greens like kale and bok choy, so this works whether or not you eat dairy.' },
      { icon:'🥩', name:'Lean protein at every meal', why:'1.8g per kg of body weight daily. Muscle mass is one of the strongest protective factors through the menopause transition and beyond.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 supports heart health and brain function, both of which are affected as estrogen declines. Aim for two to three servings a week.' },
      { icon:'🫘', name:'Soy foods', why:'Phytoestrogens may modestly support symptom management in some women. Evidence is emerging and effects vary individually.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and folate support mood and sleep, both commonly disrupted during the perimenopause transition.' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium for sleep quality and mood regulation when hormonal fluctuation most affects both.' },
    ],
    avoid: [
      'Alcohol, which worsens hot flashes and disrupts sleep architecture',
      'Excess caffeine, which triggers hot flashes in many women',
      'High sodium, which worsens cardiovascular risk that rises with declining estrogen',
      'Ultra-processed foods, which drive insulin resistance already worsened by estrogen loss',
    ],
  },
  observation: {
    desc: 'Consistent nutrition builds your baseline',
    science: 'Building your hormonal picture takes time. Consistent protein intake and balanced meals support any phase and give the algorithm more to work with.',
    sectionLabel: 'Foods to prioritise while building your baseline',
    foods: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids and choline for neurotransmitter production at any phase.' },
      { icon:'🥦', name:'Broccoli', why:'Contains a compound that supports healthy estrogen metabolism at any cycle stage.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 supports mood, focus, and keeps inflammation in check at any phase of your cycle.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre for stable energy and blood sugar throughout the day.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and fat-soluble vitamin absorption at any phase.' },
      { icon:'🌾', name:'Oats', why:'Complex carbohydrates for stable blood sugar and consistent energy while your pattern is being established.' },
    ],
    avoid: [
      'Ultra-processed foods, which blunt hormonal signal quality and worsen insulin sensitivity',
      'Excess alcohol, which disrupts estrogen metabolism and sleep',
    ],
  },
}

const DIET_OPTIONS = [
  { val: null,             label: 'No preference' },
  { val: 'vegetarian',    label: 'Vegetarian' },
  { val: 'vegan',         label: 'Vegan' },
  { val: 'pescatarian',   label: 'Pescatarian' },
  { val: 'anti_inflammatory', label: 'Anti-inflammatory' },
  { val: 'gluten_free',   label: 'Gluten-free' },
  { val: 'dairy_free',    label: 'Dairy-free' },
]

const DIET_PRIORITY = ['vegan','vegetarian','pescatarian','anti_inflammatory','gluten_free','dairy_free']

function parseDiets(val) {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [p] }
  catch { return [val] }
}

const DIET_FOODS = {
  vegetarian: {
    Menstrual: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids, plus iron and zinc that are lost during menstruation.' },
      { icon:'🫘', name:'Lentils with spinach', why:'Plant-based iron and folate. Pair with vitamin C from citrus or bell pepper to significantly boost absorption.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Magnesium and zinc, both depleted during bleeding. Magnesium relaxes smooth muscle and may reduce cramping severity.' },
      { icon:'🧀', name:'Greek yogurt', why:'Calcium and complete protein. Calcium intake is associated with reduced menstrual cramp severity in clinical trials.' },
      { icon:'🟤', name:'Dark chocolate (70%+)', why:'Rich source of magnesium. Carbohydrate cravings are driven by serotonin demand at the lowest estrogen point of the cycle.' },
      { icon:'🫚', name:'Ginger', why:'Gingerols and shogaols lower prostaglandins, the pain-causing hormones that drive cramps. One randomized trial found ginger eased pain about as well as ibuprofen on day one (Ozgoli 2009); evidence is still limited, so use it alongside your usual pain relief, not instead.' },
    ],
    Follicular: [
      { icon:'🥚', name:'Eggs', why:'Complete protein supporting muscle protein synthesis as estrogen rises and anabolic conditions improve.' },
      { icon:'🧀', name:'Greek yogurt', why:'Protein, calcium, and probiotics. Rising estrogen supports healthy gut microbiome signalling.' },
      { icon:'🌾', name:'Quinoa', why:'One of the few complete plant proteins. Complex carbohydrates are efficiently used as estrogen improves insulin sensitivity.' },
      { icon:'🥑', name:'Avocado', why:'Monounsaturated fats support estrogen production and absorption of fat-soluble vitamins.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants reduce oxidative stress from increasing training load and support gut health for hormone clearance.' },
      { icon:'🥦', name:'Broccoli', why:'Contains a compound that supports healthy estrogen metabolism and clearance.' },
    ],
    Ovulatory: [
      { icon:'🥚', name:'Eggs', why:'Complete protein. Lighter than red meat before peak training sessions.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at higher training intensity.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein with complex carbohydrates, light enough before peak sessions.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 and healthy fats that support your hormonal environment.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at high training intensity.' },
      { icon:'🥒', name:'Cucumber', why:'Micronutrients and hydration without adding digestive load.' },
    ],
    Luteal: [
      { icon:'🥚', name:'Eggs', why:'Highest-quality complete protein. Progesterone causes your body to break down muscle protein faster, so consistent intake throughout the day is a priority.' },
      { icon:'🧀', name:'Greek yogurt', why:'Protein and calcium. Calcium and B6 are cofactors for serotonin synthesis, which becomes less stable in the luteal phase.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates stabilise serotonin, which drops progressively through the luteal phase and drives mood changes.' },
      { icon:'🥬', name:'Leafy greens', why:'Calcium and B6 support serotonin and dopamine synthesis. Magnesium aids sleep and muscle relaxation.' },
      { icon:'🍫', name:'Dark chocolate', why:'Magnesium supports mood, muscle relaxation, and sleep. Partially addresses serotonin-driven cravings.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and soluble fibre for stable blood sugar when energy fluctuates most.' },
    ],
    Perimenopause: [
      { icon:'🧀', name:'Greek yogurt', why:'Calcium is a priority as estrogen falls and bone turnover accelerates. Protein supports muscle maintenance.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein at every meal. 1.8g per kg daily supports muscle mass through the transition.' },
      { icon:'🫘', name:'Tofu', why:'Phytoestrogens may modestly support symptom management. Also a complete protein for vegetarian diets.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and folate support mood and sleep, both commonly disrupted during the perimenopause transition.' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium for sleep quality and mood regulation when hormonal fluctuation affects both.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supports cardiovascular and cognitive health affected by declining estrogen.' },
    ],
    observation: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids and choline for neurotransmitter production at any phase.' },
      { icon:'🧀', name:'Greek yogurt', why:'Protein and probiotics for gut health and hormone clearance.' },
      { icon:'🥦', name:'Broccoli', why:'Supports healthy estrogen metabolism at any cycle stage.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre for stable energy and blood sugar.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and fat-soluble vitamin absorption.' },
      { icon:'🌾', name:'Oats', why:'Complex carbohydrates for stable blood sugar while your pattern is established.' },
    ],
  },
  vegan: {
    Menstrual: [
      { icon:'🫘', name:'Lentils with spinach', why:'Plant-based iron and folate. Pair with vitamin C from citrus or bell pepper to triple how much iron your body absorbs.' },
      { icon:'🥢', name:'Tofu (iron-set)', why:'Iron and complete protein when combined with variety. Calcium-set tofu also provides calcium.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Magnesium and zinc, both depleted during bleeding. Magnesium relaxes smooth muscle and may reduce cramping.' },
      { icon:'🟤', name:'Dark chocolate (70%+)', why:'Rich source of magnesium for smooth muscle relaxation. Addresses serotonin-driven carbohydrate cravings.' },
      { icon:'🥛', name:'Fortified plant milk', why:'Calcium, B12, and vitamin D. All three are important for plant-based diets and are depleted by bleeding and low estrogen.' },
      { icon:'🫚', name:'Ginger', why:'Gingerols and shogaols lower prostaglandins, the pain-causing hormones that drive cramps. One randomized trial found ginger eased pain about as well as ibuprofen on day one (Ozgoli 2009); evidence is still limited, so use it alongside your usual pain relief, not instead.' },
    ],
    Follicular: [
      { icon:'🥢', name:'Tempeh', why:'Fermented soy with the highest plant protein content. Fermentation increases nutrient bioavailability and adds probiotics.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein with all essential amino acids. Complex carbohydrates used efficiently as estrogen improves insulin sensitivity.' },
      { icon:'🥢', name:'Edamame', why:'Complete protein and phytoestrogens. Supports anabolic conditions during the highest-energy phase of the cycle.' },
      { icon:'🥑', name:'Avocado', why:'Monounsaturated fats support estrogen production and fat-soluble vitamin absorption.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants reduce oxidative stress from increasing training load and support gut health for hormone clearance.' },
      { icon:'🥦', name:'Broccoli', why:'Supports estrogen metabolism and has anti-inflammatory properties.' },
    ],
    Ovulatory: [
      { icon:'🥢', name:'Edamame', why:'Complete plant protein with all essential amino acids. Light enough before peak training sessions.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at peak training intensity.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein and complex carbohydrates without digestive drag before peak sessions.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 and healthy fats that support your hormonal environment at peak estrogen.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at high training intensity.' },
      { icon:'🥒', name:'Cucumber', why:'Hydration and micronutrients without adding digestive load before peak sessions.' },
    ],
    Luteal: [
      { icon:'🥢', name:'Tempeh', why:'Highest plant protein content. Progesterone causes your body to break down muscle protein faster, so vegan diets need to be especially consistent with protein intake.' },
      { icon:'🥢', name:'Tofu', why:'Complete protein when diet is varied. Eaten across multiple meals achieves the elevated luteal protein target.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates stabilise serotonin, which drops progressively through the luteal phase.' },
      { icon:'🥬', name:'Leafy greens', why:'Calcium and B6 support serotonin and dopamine synthesis when both become less stable.' },
      { icon:'🍫', name:'Dark chocolate', why:'Magnesium for mood, muscle relaxation, and sleep. Partially addresses serotonin-driven cravings.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and soluble fibre for stable blood sugar when energy fluctuates most.' },
    ],
    Perimenopause: [
      { icon:'🥛', name:'Fortified soy or oat milk', why:'Calcium, vitamin D, and B12 all require active attention on a vegan diet as estrogen falls and bone turnover increases.' },
      { icon:'🥢', name:'Tofu', why:'Phytoestrogens may modestly support symptom management. Complete protein for meeting the 1.8g/kg target.' },
      { icon:'🥢', name:'Tempeh', why:'Highest plant protein content. Fermentation improves nutrient bioavailability.' },
      { icon:'🥬', name:'Leafy greens', why:'Calcium, magnesium, and folate support mood and sleep disrupted by hormonal fluctuation.' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium for sleep quality and mood regulation.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supports heart health and brain function as estrogen declines.' },
    ],
    observation: [
      { icon:'🥢', name:'Tofu', why:'Complete protein when diet is varied. Eaten across meals supports daily protein targets.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein with all essential amino acids for baseline nutrition.' },
      { icon:'🥦', name:'Broccoli', why:'Supports healthy estrogen metabolism at any cycle stage.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre for stable energy and blood sugar throughout the day.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and fat-soluble vitamin absorption.' },
      { icon:'🌾', name:'Oats', why:'Complex carbohydrates for stable blood sugar while your pattern is established.' },
    ],
  },
  pescatarian: {
    Menstrual: [
      { icon:'🐟', name:'Sardines', why:'Iron and omega-3 in one food. Omega-3 helps reduce prostaglandins, the pain-causing hormones that drive cramping, alongside iron replenishment from bleeding.' },
      { icon:'🥬', name:'Leafy greens with citrus', why:'Plant-based iron and folate paired with vitamin C, which can triple how much iron your body absorbs.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein with iron and zinc, both lost during bleeding.' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium for smooth muscle relaxation and carbohydrate cravings driven by low serotonin.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Magnesium and zinc. Zinc supports immune function and tissue repair during menstruation.' },
      { icon:'🫚', name:'Ginger', why:'Lowers prostaglandins, the pain-causing hormones that drive cramps. One randomized trial found ginger eased pain about as well as ibuprofen on day one (Ozgoli 2009); evidence is still limited, so use it alongside your usual pain relief, not instead.' },
    ],
    Follicular: [
      { icon:'🐟', name:'Salmon', why:'Complete protein and omega-3 fatty acids supporting muscle building as estrogen creates anabolic conditions.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein with choline supporting neurotransmitter production as estrogen and serotonin rise.' },
      { icon:'🧀', name:'Greek yogurt', why:'Protein, calcium, and probiotics supporting gut health for hormone clearance.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants reduce oxidative stress from increasing training load.' },
      { icon:'🥑', name:'Avocado', why:'Monounsaturated fats support estrogen production and fat-soluble vitamin absorption.' },
      { icon:'🥦', name:'Broccoli', why:'Supports estrogen metabolism and clearance through this phase.' },
    ],
    Ovulatory: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 fatty acids and complete protein supporting peak training performance and recovery.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at peak intensity.' },
      { icon:'🌾', name:'Quinoa', why:'Complete protein and complex carbohydrates, light enough before peak sessions.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supporting your hormonal environment at peak estrogen.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at high intensity.' },
      { icon:'🥒', name:'Cucumber', why:'Hydration and micronutrients without digestive load.' },
    ],
    Luteal: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 fatty acids reduce luteal-phase inflammation and support mood via DHA neural pathways. Also highest protein priority.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein. Progesterone causes your body to break down muscle protein faster, so consistent intake across the day is the priority.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates stabilise serotonin as progesterone rises and mood becomes less stable.' },
      { icon:'🥬', name:'Leafy greens', why:'Calcium and B6 support serotonin and dopamine synthesis when both become less stable.' },
      { icon:'🍫', name:'Dark chocolate', why:'Magnesium for mood, muscle relaxation, and sleep quality.' },
      { icon:'🐟', name:'Sardines', why:'Omega-3 and anti-inflammatory effect specifically useful in the second half of the luteal phase.' },
    ],
    Perimenopause: [
      { icon:'🧀', name:'Greek yogurt', why:'Calcium and protein both matter more as estrogen falls and bone turnover accelerates.' },
      { icon:'🐟', name:'Salmon', why:'Omega-3 fatty acids support cardiovascular and cognitive health both affected by declining estrogen.' },
      { icon:'🐟', name:'Sardines with bones', why:'Calcium from bone-in fish plus omega-3. One of the highest combined calcium-protein sources available.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein at every meal to meet 1.8g/kg target for muscle maintenance through the transition.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and folate support mood and sleep disrupted by hormonal fluctuation.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 for cardiovascular and cognitive support.' },
    ],
    observation: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids and choline for neurotransmitter production.' },
      { icon:'🐟', name:'Salmon', why:'Omega-3 fatty acids support mood, cognition, and inflammation regulation.' },
      { icon:'🧀', name:'Greek yogurt', why:'Protein and probiotics for gut health and hormone clearance.' },
      { icon:'🥦', name:'Broccoli', why:'Supports healthy estrogen metabolism at any cycle stage.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre for stable energy and blood sugar.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and fat-soluble vitamin absorption.' },
    ],
  },
  anti_inflammatory: {
    Menstrual: [
      { icon:'🐟', name:'Salmon and sardines', why:'Omega-3 lowers prostaglandins, the pain-causing hormones, and may modestly reduce period pain when eaten consistently (Rahbar et al. 2012). Best used alongside your usual pain relief, not as a replacement.' },
      { icon:'🫚', name:'Turmeric with black pepper', why:'Curcumin reduces the production of prostaglandins, the pain-causing hormones. Black pepper increases how much curcumin your body absorbs by up to 2000%.' },
      { icon:'🫚', name:'Ginger', why:"Ginger's active compounds are natural anti-inflammatories with well-documented effects on period pain." },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supports an anti-inflammatory diet alongside the omega-3 from fish.' },
      { icon:'🥬', name:'Leafy greens with citrus', why:'Iron, magnesium, and vitamin C. Anti-inflammatory micronutrients support recovery from bleeding.' },
      { icon:'🟤', name:'Dark chocolate (70%+)', why:'Polyphenols and magnesium. High-quality dark chocolate has measurable anti-inflammatory properties.' },
    ],
    Follicular: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 and complete protein supporting muscle building during the highest anabolic window.' },
      { icon:'🫒', name:'Extra virgin olive oil', why:'Naturally anti-inflammatory and supportive of estrogen metabolism. A staple of the Mediterranean diet pattern, the most-studied dietary approach for women\'s long-term health.' },
      { icon:'🫐', name:'Berries', why:'Polyphenols and anthocyanins reduce inflammatory markers and oxidative stress from increasing training.' },
      { icon:'🥦', name:'Broccoli', why:'Contains compounds that support estrogen metabolism and have anti-inflammatory properties.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 alongside fish for a stronger combined anti-inflammatory effect.' },
      { icon:'🥚', name:'Eggs', why:'Complete protein with choline, anti-inflammatory when balanced with omega-3 intake.' },
    ],
    Ovulatory: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 and complete protein. Anti-inflammatory effect is especially relevant around ovulation when ligament laxity peaks.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants and polyphenols protect against oxidative stress at peak training intensity.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and have natural anti-inflammatory properties that help at peak training intensity.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supporting your anti-inflammatory baseline around peak training output.' },
      { icon:'🫚', name:'Turmeric', why:'Curcumin supports systemic anti-inflammatory pattern. Consistent daily use builds effect over time.' },
      { icon:'🥬', name:'Leafy greens', why:'Micronutrients, antioxidants, and anti-inflammatory compounds for peak performance.' },
    ],
    Luteal: [
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 supports mood and brain function, and helps keep the inflammation that drives PMS symptoms in check.' },
      { icon:'🍠', name:'Sweet potato', why:'Beta-carotene is a potent antioxidant. Complex carbohydrates stabilise serotonin as progesterone rises.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and calcium support mood, sleep, and serotonin synthesis in the most symptom-prone phase.' },
      { icon:'🍫', name:'Dark chocolate', why:'Polyphenols and magnesium. Anti-inflammatory properties alongside magnesium for mood and sleep.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 and polyphenols for mood support and lower inflammation in the late luteal phase.' },
      { icon:'🫚', name:'Turmeric', why:'Curcumin reduces inflammation and may reduce PMS symptom severity with consistent daily use.' },
    ],
    Perimenopause: [
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 supports heart health and brain function, both affected by estrogen loss. Also helps with joint pain, which is common during perimenopause.' },
      { icon:'🫒', name:'Extra virgin olive oil', why:'Natural anti-inflammatory properties. The Mediterranean diet pattern is the most well-studied dietary approach for women in perimenopause.' },
      { icon:'🫐', name:'Berries', why:'Polyphenols support cardiovascular health and cognitive function as estrogen declines.' },
      { icon:'🫚', name:'Turmeric', why:'Curcumin reduces systemic inflammation elevated by declining estrogen.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium, calcium, and anti-inflammatory compounds for bone, mood, and sleep.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 for heart health and brain function.' },
    ],
    observation: [
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 supports mood, focus, and a lower-inflammation baseline that benefits every phase of your cycle.' },
      { icon:'🫐', name:'Berries', why:'Polyphenols and antioxidants for general anti-inflammatory baseline.' },
      { icon:'🫒', name:'Extra virgin olive oil', why:'Natural anti-inflammatory properties that build with consistent daily use.' },
      { icon:'🥦', name:'Broccoli', why:'Contains compounds that support both anti-inflammatory health and hormone metabolism.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 for a consistent anti-inflammatory diet.' },
      { icon:'🫚', name:'Turmeric with black pepper', why:'Curcumin anti-inflammatory effect builds with consistent daily use.' },
    ],
  },
  gluten_free: {
    Menstrual: [
      { icon:'🥩', name:'Red meat', why:'Iron from red meat is the most absorbable form available, making it the most effective food source for replacing what is lost during bleeding.' },
      { icon:'🥬', name:'Leafy greens with citrus', why:'Plant-based iron and folate. Vitamin C can triple how much iron your body absorbs.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 helps reduce the hormones that cause cramping. Naturally gluten-free.' },
      { icon:'🟤', name:'Dark chocolate (70%+, GF label)', why:'Magnesium for smooth muscle relaxation. Check the gluten-free label, as cross-contamination is possible in some brands.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Magnesium and zinc, both depleted during menstruation. Naturally gluten-free.' },
      { icon:'🍚', name:'White or brown rice', why:'Easily digestible complex carbohydrates. Naturally gluten-free alternative to wheat-based grains.' },
    ],
    Follicular: [
      { icon:'🥚', name:'Eggs', why:'Complete protein supporting muscle protein synthesis as estrogen rises.' },
      { icon:'🐔', name:'Chicken or turkey', why:'Lean complete protein naturally gluten-free. Support muscle building during the anabolic phase.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein and complex carbohydrates. Naturally gluten-free alternative to wheat.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants reduce oxidative stress from increasing training load.' },
      { icon:'🥑', name:'Avocado', why:'Monounsaturated fats support estrogen production and vitamin absorption.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates naturally gluten-free, efficiently used as estrogen improves insulin sensitivity.' },
    ],
    Ovulatory: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 and complete protein naturally gluten-free for peak performance.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at peak intensity.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein, light and gluten-free before peak sessions.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supporting your hormonal environment at peak estrogen.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance.' },
      { icon:'🥒', name:'Cucumber', why:'Hydration without digestive load before peak sessions.' },
    ],
    Luteal: [
      { icon:'🥩', name:'Red meat or tofu', why:'Protein requirements are highest in the luteal phase. Both are naturally gluten-free.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates stabilise serotonin. Naturally gluten-free.' },
      { icon:'🥬', name:'Leafy greens with eggs', why:'Calcium and B6 for serotonin and dopamine synthesis.' },
      { icon:'🍫', name:'Dark chocolate (GF label)', why:'Magnesium for mood, muscle relaxation, and sleep.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 helps reduce inflammation in the second half of your cycle. Naturally gluten-free.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein and fibre for stable blood sugar. Naturally gluten-free.' },
    ],
    Perimenopause: [
      { icon:'🧀', name:'Greek yogurt', why:'Calcium and protein. Naturally gluten-free. Calcium matters more as bone turnover accelerates.' },
      { icon:'🥩', name:'Lean protein at every meal', why:'1.8g per kg daily. All whole protein sources are naturally gluten-free.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 for heart health and brain function. Naturally gluten-free.' },
      { icon:'🫘', name:'Soy foods (GF tamari)', why:'Phytoestrogens may modestly support symptom management. Use gluten-free tamari instead of soy sauce.' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and calcium for bone, mood, and sleep.' },
      { icon:'🟤', name:'Dark chocolate (GF label)', why:'Magnesium for sleep and mood regulation.' },
    ],
    observation: [
      { icon:'🥚', name:'Eggs', why:'Complete protein naturally gluten-free for baseline nutrition.' },
      { icon:'🥦', name:'Broccoli', why:'Supports healthy estrogen metabolism at any cycle stage.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 for mood, focus, and keeping inflammation low.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre. Naturally gluten-free.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and vitamin absorption.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein and complex carbohydrates. Gluten-free.' },
    ],
  },
  dairy_free: {
    Menstrual: [
      { icon:'🥩', name:'Red meat', why:'The most absorbable form of iron, making it the most effective for replacing what is lost during bleeding.' },
      { icon:'🥛', name:'Fortified oat or soy milk', why:'Calcium and B12, especially important without dairy. Prioritise fortified sources and leafy greens.' },
      { icon:'🥬', name:'Leafy greens with citrus', why:'Calcium, iron, and vitamin C. Kale and bok choy have the highest calcium bioavailability of any plant source.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 helps reduce the hormones that cause cramping and keeps inflammation lower during bleeding.' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Magnesium and zinc, both depleted during menstruation. Dairy-free source.' },
      { icon:'🟤', name:'Dark chocolate (dairy-free)', why:'Magnesium for smooth muscle relaxation. Check the dairy-free label, as many dark chocolates contain milk.' },
    ],
    Follicular: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids. Naturally dairy-free.' },
      { icon:'🐔', name:'Chicken or turkey', why:'Lean complete protein to support muscle building as estrogen rises.' },
      { icon:'🥛', name:'Fortified plant milk', why:'Calcium and vitamin D without dairy. Adequate calcium supports bone health especially during the building phase.' },
      { icon:'🫐', name:'Berries', why:'Antioxidants reduce oxidative stress from increasing training load.' },
      { icon:'🥑', name:'Avocado', why:'Monounsaturated fats support estrogen production and vitamin absorption.' },
      { icon:'🥦', name:'Broccoli', why:'A good plant-based calcium source plus compounds that support estrogen metabolism. Naturally dairy-free.' },
    ],
    Ovulatory: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 and complete protein for peak performance. Naturally dairy-free.' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at peak intensity.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein and complex carbohydrates. Light before peak sessions.' },
      { icon:'🥜', name:'Walnuts', why:'Plant-based omega-3 supporting your hormonal environment at peak estrogen.' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at peak intensity.' },
      { icon:'🥒', name:'Cucumber', why:'Hydration without digestive load before peak sessions.' },
    ],
    Luteal: [
      { icon:'🥩', name:'Red meat or tofu', why:'Protein requirements highest in the luteal phase. Both are naturally dairy-free.' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates stabilise serotonin as progesterone rises.' },
      { icon:'🥬', name:'Leafy greens with eggs', why:'Calcium from greens (no dairy needed), B6 for serotonin and dopamine synthesis.' },
      { icon:'🍫', name:'Dark chocolate (dairy-free)', why:'Magnesium for mood, muscle relaxation, and sleep.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 reduces inflammation and supports mood in the second half of your cycle.' },
      { icon:'🫘', name:'Lentils', why:'Plant protein, iron, and fibre for stable blood sugar. Naturally dairy-free.' },
    ],
    Perimenopause: [
      { icon:'🥛', name:'Fortified soy or oat milk', why:'Calcium, vitamin D, and B12 need active planning without dairy. Prioritise fortified foods, leafy greens, and fish bones.' },
      { icon:'🥩', name:'Lean protein at every meal', why:'1.8g per kg daily. Muscle mass is one of the strongest protective factors through the transition.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 for heart health and brain function. Sardines with bones are also one of the best non-dairy calcium sources.' },
      { icon:'🥢', name:'Tofu (if soy OK)', why:'Phytoestrogens and protein. Calcium-set tofu is a significant non-dairy calcium source.' },
      { icon:'🥬', name:'Leafy greens', why:'Calcium from kale and bok choy plus magnesium for sleep and mood. Especially important without dairy.' },
      { icon:'🟤', name:'Dark chocolate (dairy-free)', why:'Magnesium for sleep quality and mood regulation.' },
    ],
    observation: [
      { icon:'🥚', name:'Eggs', why:'Complete protein naturally dairy-free for baseline nutrition.' },
      { icon:'🥛', name:'Fortified plant milk', why:'Calcium and B12 to replace what dairy provides. Check for fortification on label.' },
      { icon:'🥦', name:'Broccoli', why:'Supports estrogen metabolism and is a good plant-based calcium source.' },
      { icon:'🐟', name:'Salmon or sardines', why:'Omega-3 for mood, focus, and inflammation at any phase.' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support hormone production and fat-soluble vitamin absorption.' },
      { icon:'🌾', name:'Quinoa', why:'Complete plant protein and complex carbohydrates for stable energy.' },
    ],
  },
}

const SYMPTOMS = [
  { id:'cramping', emoji:'🩸', title:'Cramping', sub:'Period cramps and pelvic pain', remedies:[
    { name:'Salmon and sardines', why:'Omega-3 fatty acids lower prostaglandins, the pain-causing hormones behind cramps, and may modestly reduce period pain when eaten consistently (Rahbar et al. 2012). Best used alongside your usual pain relief, not as a replacement.' },
    { name:'Pumpkin seeds and dark chocolate', why:'Both are high in magnesium, which relaxes smooth muscle including the uterus. Several trials have shown magnesium reduces period pain severity versus placebo.' },
    { name:'Fresh ginger', why:'Ginger lowers prostaglandins, the pain-causing hormones that drive cramps. One randomized trial found it eased pain about as well as ibuprofen on day one (Ozgoli 2009); evidence is still limited, so use it alongside your usual pain relief, not instead.' },
    { name:'Walnuts and flaxseed', why:'Plant-based omega-3. While less potent than omega-3 from fish, eating them regularly supports an overall anti-inflammatory diet.' },
  ], avoid:['Trans fats', 'Excess alcohol', 'Tea and coffee with iron-rich meals', 'High-sodium foods'] },

  { id:'headache', emoji:'🤕', title:'Headaches and migraines', sub:'Often triggered as estrogen drops', remedies:[
    { name:'Magnesium-rich foods', why:'Pumpkin seeds, dark chocolate, and leafy greens. Magnesium is one of the most evidence-supported nutrients for reducing the frequency of hormonal and menstrual migraines.' },
    { name:'Steady hydration', why:'Even mild dehydration is a common headache trigger. Sipping water consistently through the day matters more than drinking a lot at once.' },
    { name:'Regular balanced meals', why:'Blood sugar dips are a major trigger. Eating protein, fat, and complex carbohydrates at regular intervals keeps levels stable.' },
    { name:'Riboflavin (vitamin B2) foods', why:'Eggs, dairy, almonds, and lean meat. Riboflavin has trial evidence for reducing migraine frequency over time.' },
  ], avoid:['Skipping meals', 'Dehydration', 'Excess caffeine', 'Red wine and aged cheeses if you notice they trigger you'] },

  { id:'bloating', emoji:'🫧', title:'Bloating', sub:'Luteal-phase digestive changes', remedies:[
    { name:'Probiotic foods', why:'Yogurt, kefir, and kimchi support the gut microbiome. Progesterone slows digestion, and a healthy microbiome reduces fermentation and gas production.' },
    { name:'Cooked vegetables', why:'Easier to digest than raw. Cooking breaks down fibres that ferment in the gut, reducing gas and bloating without losing nutritional value.' },
    { name:'Fennel', why:'Contains natural calming compounds that reduce intestinal spasm and gas. Used traditionally with some clinical support for easing cramping in the gut.' },
    { name:'Increased water intake', why:'Many women find staying well hydrated eases bloating. When you are adequately hydrated, the body tends to hold on to less fluid.' },
  ], avoid:['High-sodium foods', 'Carbonated drinks', 'Alcohol', 'Raw brassicas in large amounts', 'Sugar alcohols (sorbitol, xylitol)'] },

  { id:'breast', emoji:'🤍', title:'Breast tenderness', sub:'Cyclical, usually late luteal', remedies:[
    { name:'Lower caffeine', why:'Many women find cyclical breast tenderness eases when they cut back on coffee, tea, and energy drinks in the second half of the cycle.' },
    { name:'Omega-3 foods', why:'Salmon, sardines, walnuts, and flaxseed. Their anti-inflammatory effect may reduce the soreness that comes with the late-luteal hormonal shift.' },
    { name:'Vitamin E foods', why:'Almonds, sunflower seeds, and avocado. Some small trials suggest vitamin E may modestly reduce cyclical breast pain.' },
    { name:'Lower sodium', why:'Reducing salt eases the fluid retention that makes breast tissue feel fuller and more tender before your period.' },
  ], avoid:['Excess caffeine', 'High-sodium foods', 'Large amounts of saturated fat'] },

  { id:'brainfog', emoji:'🧠', title:'Brain fog', sub:'Focus, concentration, and energy', remedies:[
    { name:'Iron-rich foods', why:'Low iron stores can impair focus and memory even before anaemia shows up on a standard test. Iron supports the brain chemicals involved in attention and working memory.' },
    { name:'Salmon, sardines, or walnuts', why:'Omega-3 supports brain function and keeps inflammation in check. Research shows omega-3 can improve memory performance.' },
    { name:'Complex carbohydrates', why:'Stable blood glucose directly protects working memory and clear thinking. Blood sugar swings worsen focus noticeably.' },
    { name:'Eggs and leafy greens', why:'Choline from eggs and B vitamins from greens support the brain chemical most important for focus and learning.' },
  ], avoid:['Ultra-processed foods', 'Excess alcohol', 'Skipping meals, since blood sugar dips worsen focus quickly'] },

  { id:'pms', emoji:'💙', title:'PMS and mood', sub:'Late luteal phase support', remedies:[
    { name:'Calcium and vitamin D', why:'Low calcium intake is linked to more severe PMS across multiple large trials. One multicentre RCT of 466 women found calcium significantly reduced PMS symptoms by the third cycle of supplementation.' },
    { name:'Magnesium-rich foods', why:'Magnesium supports the same calming pathways that are disrupted as progesterone falls in the late luteal phase. Several small studies found magnesium lower in women with PMS than in symptom-free women.' },
    { name:'Vitamin B6', why:'A building block for serotonin and dopamine. A systematic review of nine RCTs found B6 may be about twice as effective as placebo for the mood symptoms of PMS.' },
    { name:'Complex carbohydrates', why:'Carbohydrate cravings in the late luteal phase are driven by a need for serotonin. Complex carbs meet that need without the blood sugar spike of refined ones.' },
  ], avoid:['Alcohol', 'Refined sugar', 'High-sodium foods', 'Excess caffeine'] },

  { id:'skin', emoji:'🧴', title:'Skin breakouts', sub:'Often in the days before your period', remedies:[
    { name:'Low-glycemic foods', why:'Whole grains, legumes, and vegetables keep blood sugar and insulin steady, which research links to fewer breakouts than a high-sugar diet.' },
    { name:'Zinc-rich foods', why:'Pumpkin seeds, lentils, and lean meat. Zinc has trial evidence for reducing inflammatory breakouts.' },
    { name:'Omega-3 foods', why:'Salmon, sardines, and walnuts help calm the inflammation behind premenstrual breakouts.' },
    { name:'Plenty of water and colourful vegetables', why:'Hydration and the antioxidants in bright vegetables support skin repair as hormones shift.' },
  ], avoid:['High-sugar foods', 'Large amounts of skim dairy', 'Ultra-processed foods'] },

  { id:'cravings', emoji:'🍫', title:'Cravings', sub:'Strongest in the late luteal phase', remedies:[
    { name:'Protein at every meal', why:'Protein is the most filling nutrient and blunts the blood sugar swings that drive cravings. It is the single most effective place to start.' },
    { name:'Complex carbohydrates', why:'Oats, sweet potato, and whole grains meet the late-luteal need for serotonin steadily, instead of the quick spike and crash of refined sugar.' },
    { name:'Magnesium-rich foods', why:'Chocolate cravings often track with magnesium needs in this phase. Pumpkin seeds, dark chocolate, and leafy greens help meet them.' },
    { name:'Regular meal timing', why:'Long gaps between meals make cravings stronger. Eating consistently through the day keeps them manageable.' },
  ], avoid:['Refined sugar', 'Skipping meals', 'Long gaps between meals'] },

  { id:'fatigue', emoji:'🔋', title:'Fatigue and low energy', sub:'Especially during and after your period', remedies:[
    { name:'Red meat or lentils', why:'Iron from red meat is absorbed at 15 to 35%, significantly higher than iron from plant sources. Women lose 30 to 80ml of blood each cycle on average, making iron replenishment a real priority.' },
    { name:'Lentils and spinach with vitamin C', why:'Plant-based iron paired with vitamin C. Vitamin C helps your body absorb plant-based iron by up to 67% more effectively.' },
    { name:'B12 sources (eggs, fish, dairy)', why:'Low B12 causes fatigue, brain fog, and low mood. It is common in younger women and those avoiding animal products.' },
  ], avoid:['Black tea or coffee within one hour of iron-rich meals, since tannins block absorption', 'Large dairy servings with iron meals, since calcium competes with iron for absorption'] },
]

const APA_REFS = [
  'Angeli, A. Minetto, M. Dovio, A. & Paccotti, P. (2016). Iron loss during menstruation and its impact on exercise performance. *European Journal of Sport Science*, *16*(1), 1 to 8.',
  'Rahbar, N. Asgharzadeh, N. & Ghorbani, R. (2012). Effect of omega-3 fatty acids on intensity of primary dysmenorrhea. *Gynecological Endocrinology*, *28*(1), 45 to 48.',
  'Harel, Z. Biro, F. M. Kottenhahn, R. K. & Rosenthal, S. L. (1996). Supplementation with omega-3 polyunsaturated fatty acids in the management of dysmenorrhea in adolescents. *American Journal of Obstetrics and Gynecology*, *174*(4), 1335 to 1338.',
  'Facchinetti, F. Borella, P. Sances, G. Fioroni, L. Nappi, R. E. & Genazzani, A. R. (1991). Oral magnesium successfully relieves premenstrual mood changes. *Obstetrics and Gynecology*, *78*(2), 177 to 181.',
  'Ozgoli, G. Goli, M. & Moattar, F. (2009). Comparison of effects of ginger, mefenamic acid, and ibuprofen on pain in women with primary dysmenorrhea. *Journal of Midwifery & Women\'s Health*, *54*(2), 74 to 78.',
  'Mauvais-Jarvis, F. Clegg, D. J. & Hevener, A. L. (2013). The role of estrogens in control of energy balance and glucose homeostasis. *Journal of Clinical Investigation*, *123*(7), 2813 to 2820.',
  'Carr, M. C. (2003). The emergence of the metabolic syndrome with menopause. *Journal of Clinical Endocrinology and Metabolism*, *88*(6), 2404 to 2411.',
  'International Society of Sports Nutrition. (2023). Position stand: Protein and exercise. *Journal of the International Society of Sports Nutrition*, *20*(1), 2221 to 2289.',
  'Aragon, A. A. & Schoenfeld, B. J. (2013). Nutrient timing revisited: Is there a post-exercise anabolic window? *Journal of the International Society of Sports Nutrition*, *10*(1), 5.',
  'Lariviere, F. Moussalli, R. & Garrel, D. R. (1994). Increased leucine flux and leucine oxidation during the luteal phase of the menstrual cycle in women. *American Journal of Physiology*, *267*(3), E422. E428.',
  'Sarwar, R. Niclos, B. B. & Rutherford, O. M. (1996). Changes in muscle strength, relaxation rate and fatigability during the human menstrual cycle. *Journal of Physiology*, *493*(1), 267 to 272.',
  'Backstrom, T. Andreen, L. Birzniece, V. Bjorn, I. Johansson, I.-M. & Nordenstam-Simpanen, M. (2008). The role of hormones and hormonal treatments in premenstrual syndrome. *Archives of Women\'s Mental Health*, *11*(3), 185 to 191.',
  'Hackney, A. C. (2006). Stress and the neuroendocrine system: The role of exercise as a stressor and modifier of stress. *Expert Reviews in Endocrinology & Metabolism*, *1*(6), 783 to 792.',
  'Burden, R. J. Morton, K. Richards, T. Whyte, G. P. & Pedlar, C. R. (2015). Is iron treatment beneficial in iron-deficient but non-anaemic (IDNA) endurance athletes? A systematic review and meta-analysis. *British Journal of Sports Medicine*, *49*(21), 1389 to 1397.',
  'Thys-Jacobs, S. Starkey, P. Bernstein, D. & Tian, J. (1998). Calcium carbonate and the premenstrual syndrome: Effects on premenstrual and menstrual symptoms. *American Journal of Obstetrics and Gynecology*, *179*(2), 444 to 452.',
  'Wyatt, K. M. Dimmock, P. W. Jones, P. W. & O\'Brien, P. M. S. (1999). Efficacy of vitamin B-6 in the treatment of premenstrual syndrome: Systematic review. *BMJ*, *318*(7195), 1375 to 1381.',
  'Rawson, E. S. Miles, M. P. & Larson-Meyer, D. E. (2018). Dietary supplements for health, adaptation, and recovery in athletes. *International Journal of Sport Nutrition and Exercise Metabolism*, *28*(2), 188 to 199.',
  'Candow, D. G. Forbes, S. C. Chilibeck, P. D. Cornish, S. M. Antonio, J. & Kreider, R. B. (2021). Effectiveness of creatine supplementation on aging muscle and bone: Focus on falls prevention and inflammation. *Nutrients*, *13*(6), 2038.',
  'Sims, S. T. & Yeager, S. (2024). *ROAR: How to match your food and fitness to your unique female physiology for optimum performance, great health, and a strong, lean body for life* (Rev. ed.). Rodale.',
  'Hamadeh, M. J. Devries, M. C. & Tarnopolsky, M. A. (2005). Estrogen supplementation reduces whole body leucine and carbohydrate oxidation and increases lipid oxidation in men during endurance exercise. *Journal of Clinical Endocrinology and Metabolism*, *90*(6), 3592 to 3599.',
  'Akin, M. D. Weingand, K. W. Hengehold, D. A. Goodale, M. B. Hinkle, R. T. & Smith, R. P. (2001). Continuous low-level topical heat in the treatment of dysmenorrhea. *Obstetrics and Gynecology*, *97*(3), 343 to 349.',
  'Hallberg, L. Brune, M. & Rossander, L. (1989). Iron absorption in man: Ascorbic acid and dose-dependent inhibition by phytate. *American Journal of Clinical Nutrition*, *49*(1), 140 to 144.',
  'Rogerson, D. (2017). Vegan diets: Practical advice for athletes and exercisers. *Journal of the International Society of Sports Nutrition*, *14*, 36.',
  'Mariotti, F. & Gardner, C. D. (2019). Dietary protein and amino acids in vegetarian diets. A review. *Nutrients*, *11*(11), 2661.',
  'Calder, P. C. (2006). n-3 polyunsaturated fatty acids, inflammation, and inflammatory diseases. *American Journal of Clinical Nutrition*, *83*(6 Suppl), 1505S, 1519S.',
  'Aggarwal, B. B. & Harikumar, K. B. (2009). Potential therapeutic effects of curcumin, the anti-inflammatory agent, against neurodegenerative, cardiovascular, pulmonary, metabolic, autoimmune and neoplastic diseases. *International Journal of Biochemistry & Cell Biology*, *41*(1), 40 to 59.',
  'Rosillo, M. A. Sanchez-Hidalgo, M. Cardeno, A. & Alarcon de la Lastra, C. (2011). Protective effect of extra-virgin olive oil polyphenol oleocanthal in intestinal inflammation. *Molecular Nutrition & Food Research*, *55*(6), 892 to 900.',
  'Weaver, C. M. Proulx, W. R. & Heaney, R. (1999). Choices for achieving adequate dietary calcium with a vegetarian diet. *American Journal of Clinical Nutrition*, *70*(3 Suppl), 543S, 548S.',
]

// Plain-language, phase-aware explanation of the protein number so it isn't a bare figure.
const PROTEIN_NOTE = {
  Menstrual:     'Protein supports recovery and steadier energy while you bleed. Spread it across your meals.',
  Follicular:    'Rising estrogen makes this your strongest phase to build muscle, protein fuels it.',
  Ovulatory:     'Protein supports your peak-performance training window this week.',
  Luteal:        'Protein needs peak now: progesterone speeds up how fast you break muscle down.',
  Perimenopause: 'Protein protects muscle and bone through the transition, aim for it at every meal.',
  observation:   'Consistent protein supports every phase while we learn your pattern.',
}

export default function Nutrition() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('observation')
  const [targets, setTargets] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('foods')
  const [openSymptom, setOpenSymptom] = useState(null)
  const [showRefs, setShowRefs] = useState(false)
  const [showFasting, setShowFasting] = useState(false)
  const [showCravings, setShowCravings] = useState(false)
  const [personalisedFocus, setPersonalisedFocus] = useState(null)
  const [showUpdateSheet, setShowUpdateSheet] = useState(false)
  const [editWeight, setEditWeight] = useState('')
  const [editFitness, setEditFitness] = useState('')
  const [editDiets, setEditDiets] = useState([])
  const [savingStats, setSavingStats] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const status = await getTodayStatus(supabase, user.id)
      const prof = status?.profile || null
      setProfile(prof)
      setEditDiets(parseDiets(prof?.diet_preference))
      const p = status?.subPhase || status?.phase || 'observation'
      setPhase(p)
      setTargets(status?.nutritionTargets || null)
      if (status?.personalisedFocus) {
        setPersonalisedFocus(status.personalisedFocus)
        setOpenSymptom(status.personalisedFocus.focus)
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function saveStats() {
    setSavingStats(true)
    const { data: { user } } = await supabase.auth.getUser()
    const updates = {}
    if (editWeight) updates.body_weight_kg = parseFloat(editWeight)
    if (editFitness) updates.fitness_level = editFitness
    updates.diet_preference = editDiets.length > 0 ? JSON.stringify(editDiets) : null
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id)
    }
    setSavingStats(false)
    setShowUpdateSheet(false)
    // Re-run init so the protein target (and vegan multiplier) reflect the new weight
    // and diet immediately, getTodayStatus recomputes nutritionTargets from the DB.
    await init()
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  // Pregnancy mode, prenatal nutrition (Health Canada / ACOG), not cycle-phase foods.
  if (profile?.user_path === '6') {
    const t = targets
    const cardS = { background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }
    return (
      <div style={{ paddingBottom:120 }}>
        <TopBar title="NUTRITION" subtitle="PREGNANCY" subtitleColor="#c8b89a" />
        <div style={{ background:'linear-gradient(135deg, #3a2c3a, #2a1f2a)', padding:'20px 16px', marginBottom:16 }}>
          <div style={{ fontSize:11, color:'#c8b89a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Prenatal nutrition</div>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, color:'#f5f0e8', marginBottom:6 }}>Eat twice as healthy, not twice as much.</div>
          <div style={{ fontSize:12, color:'rgba(245,240,232,0.75)', lineHeight:1.6 }}>General guidance from Health Canada and ACOG. Confirm amounts with your doctor, midwife, or dietitian.</div>
        </div>
        {t && (
          <div style={{ margin:'0 16px 12px', background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700 }}>{t.proteinG}g</div><div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Protein today</div></div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700 }}>{t.extraCalories > 0 ? '+' : ''}{t.extraCalories}</div><div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Extra kcal</div></div>
            </div>
            <div style={{ fontSize:12, color:'#5a4a3a', textAlign:'center', marginTop:8, lineHeight:1.5 }}>{t.headline}</div>
          </div>
        )}
        <div style={{ padding:'0 16px' }}>
          <div style={cardS}>
            <div className="section-label" style={{ marginBottom:8 }}>Prioritise</div>
            <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.8 }}>A daily <strong>prenatal vitamin</strong> with <strong>folic acid (400 mcg)</strong> and iron · iron-rich foods with vitamin C · calcium (dairy, fortified plant milk, canned fish with bones, leafy greens) · <strong>2 to 3 servings/week of low-mercury fish</strong> (salmon, trout, light canned tuna) or a DHA source · choline (eggs) · <strong>8 to 12 cups of fluid a day</strong>, mostly water.</div>
            <div style={{ fontSize:11, color:'#9a9590', marginTop:8, fontStyle:'italic' }}>Health Canada Prenatal Nutrition Guidelines; ACOG.</div>
          </div>
          <div style={{ background:'#fdf5f0', border:'1px solid #f0d8cc', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a6a50', marginBottom:8 }}>Avoid or limit</div>
            <div style={{ fontSize:13, color:'#7a4a30', lineHeight:1.8 }}><strong>Alcohol, none</strong> (no known safe amount) · high-mercury fish (shark, swordfish, marlin, king mackerel, tilefish, fresh tuna) · unpasteurised milk and soft cheeses (brie, feta, blue) · deli meats and hot dogs unless heated steaming hot · raw or undercooked meat, eggs, fish, and sushi · raw sprouts · unwashed produce · <strong>caffeine over about 200 mg a day</strong> (roughly one coffee).</div>
            <div style={{ fontSize:11, color:'#b08a6a', marginTop:8, fontStyle:'italic' }}>Health Canada; ACOG.</div>
          </div>
          <div style={cardS}>
            <div className="section-label" style={{ marginBottom:8 }}>If you have morning sickness</div>
            <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.7 }}>Small, frequent meals so your stomach is never empty, dry bland carbs (toast, crackers) before getting up, ginger, and sipping fluids between meals can all help. If you cannot keep fluids down or are losing weight, contact your provider.</div>
            <div style={{ fontSize:11, color:'#9a9590', marginTop:8, fontStyle:'italic' }}>ACOG; SOGC.</div>
          </div>
          <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.6, textAlign:'center', padding:'4px 8px 0' }}>General guidance, not medical advice. Your needs may differ, confirm supplements and food choices with your doctor, midwife, or registered dietitian.</div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // Collapse subphases to the key the food/gradient tables use. Luteal subphases →
  // Luteal; perimenopause stages (status.subPhase is "Early/Late perimenopause" or
  // "Postmenopause") → Perimenopause, otherwise these fell through to observation and
  // path-4 users never saw the calcium/bone-protective perimenopause guidance.
  const phaseKey = ['Early luteal','Mid luteal','Late luteal'].includes(phase) ? 'Luteal'
    : ['Early perimenopause','Late perimenopause','Postmenopause','Perimenopause'].includes(phase) ? 'Perimenopause'
    : phase
  const phaseData = PHASE_DATA[phaseKey] || PHASE_DATA.observation
  const gradient = PHASE_GRADIENT[phase] || PHASE_GRADIENT[phaseKey] || PHASE_GRADIENT.observation
  const displayPhase = phase === 'observation' ? 'Building baseline' : phase
  const activeDiets = parseDiets(profile?.diet_preference)
  const primaryDiet = DIET_PRIORITY.find(d => activeDiets.includes(d)) || null
  const dietFoods = primaryDiet ? (DIET_FOODS[primaryDiet]?.[phaseKey] || DIET_FOODS[primaryDiet]?.observation || phaseData.foods) : phaseData.foods
  const isVegan = activeDiets.includes('vegan')
  // Vegan +15% is already baked into targets.proteinG by getNutritionTargets, so just display it.
  const displayProtein = targets ? targets.proteinG : null
  const dietLabel = activeDiets.map(d => DIET_OPTIONS.find(o => o.val === d)?.label).filter(Boolean).join(' + ')

  return (
    <div style={{ paddingBottom:120 }}>
      <TopBar title="NUTRITION" subtitle={displayPhase.toUpperCase()} subtitleColor="#c8b89a" />

      {/* Phase banner */}
      <div style={{ background:gradient, padding:'20px 16px', marginBottom:16 }}>
        <div style={{ fontSize:11, color:'#c8b89a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>THIS PHASE</div>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, color:'#f5f0e8', marginBottom:6 }}>{phaseData.desc}</div>
        <div style={{ fontSize:12, color:'rgba(245,240,232,0.75)', lineHeight:1.7 }}>{phaseData.science}</div>
      </div>

      {/* Profile stats bar, always shown so user can always access Update sheet */}
      <div style={{ margin:'0 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', border:'1px solid #ede8e0', borderRadius:10, padding:'10px 14px' }}>
        <div style={{ fontSize:12, color:'#7a7268' }}>
          {profile?.body_weight_kg && <span>{profile.body_weight_kg}kg</span>}
          {profile?.body_weight_kg && profile?.fitness_level && <span style={{ margin:'0 6px', color:'#c8b89a' }}>·</span>}
          {profile?.fitness_level && <span style={{ textTransform:'capitalize' }}>{profile.fitness_level}</span>}
          {activeDiets.length > 0 && (
            <>
              {(profile?.body_weight_kg || profile?.fitness_level) && <span style={{ margin:'0 6px', color:'#c8b89a' }}>·</span>}
              <span>{dietLabel}</span>
            </>
          )}
          {!profile?.body_weight_kg && !profile?.fitness_level && activeDiets.length === 0 && (
            <span style={{ color:'#9a9590' }}>Add your stats for personalised targets</span>
          )}
        </div>
        <button onClick={() => { setEditWeight(profile?.body_weight_kg||''); setEditFitness(profile?.fitness_level||''); setEditDiets(parseDiets(profile?.diet_preference)); setShowUpdateSheet(true) }}
          style={{ background:'none', border:'none', fontSize:12, color:'#c8b89a', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          Update
        </button>
      </div>

      {/* Targets */}
      {targets && (
        <div style={{ margin:'0 16px 16px', background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16 }}>
          {targets.extraCalories > 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:30, fontWeight:700, color:'#2c2820' }}>{displayProtein}g</div>
                <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Protein today</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:30, fontWeight:700, color:'#2c2820' }}>+{targets.extraCalories}</div>
                <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Extra fuel (kcal)</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:34, fontWeight:700, color:'#2c2820' }}>{displayProtein}g</div>
              <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Protein target today</div>
            </div>
          )}
          <div style={{ fontSize:12.5, color:'#5a4a3a', textAlign:'center', marginTop:10, lineHeight:1.55 }}>{PROTEIN_NOTE[phaseKey] || PROTEIN_NOTE.observation}</div>
          <div style={{ fontSize:11, color:'#9a9590', textAlign:'center', marginTop:6 }}>
            {profile?.body_weight_kg ? 'Based on your weight and phase' : 'Set your weight above to personalise this'} · ISSN 2023
          </div>
          {personalisedFocus && (
            <div style={{ fontSize:12, color:'#5a4a3a', background:'#f5f0e8', borderRadius:8, padding:'8px 10px', marginTop:10, lineHeight:1.5 }}>
              {personalisedFocus.reason}
            </div>
          )}
          {isVegan && (
            <div style={{ fontSize:11, color:'#7a7268', textAlign:'center', marginTop:6, lineHeight:1.5 }}>
              +15% applied for plant protein bioavailability (Rogerson, 2017)
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', margin:'0 16px 16px', background:'#f5f0e8', borderRadius:10, padding:3 }}>
        {[['foods','Phase foods'],['symptoms','Symptom relief']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
            background:tab===id?'#fff':'transparent', fontWeight:tab===id?500:400,
            color:tab===id?'#2c2820':'#7a7268', fontFamily:'inherit',
            boxShadow:tab===id?'0 1px 4px rgba(44,40,32,0.08)':'none',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'foods' ? (
        <div style={{ padding:'0 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>{personalisedFocus ? 'Based on your recent logs' : phaseData.sectionLabel}</span>
            {activeDiets.length > 0 && (
              <span style={{ fontSize:11, fontWeight:600, color:'#c8b89a', background:'#f5f0e8', padding:'2px 8px', borderRadius:6 }}>
                {dietLabel}
              </span>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {dietFoods.map(f => (
              <div key={f.name} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:12 }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{f.icon}</div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#2c2820' }}>{f.name}</div>
                <div style={{ fontSize:11, color:'#7a7268', lineHeight:1.6 }}>{f.why}</div>
              </div>
            ))}
          </div>

          {phaseData.avoid.length > 0 && (
            <div style={{ background:'#fdf5f0', border:'1px solid #f0d8cc', borderRadius:12, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a6a50', marginBottom:8 }}>Limit this phase</div>
              {phaseData.avoid.map(a => (
                <div key={a} style={{ fontSize:12, color:'#7a4a30', marginBottom:6, paddingLeft:10, borderLeft:'2px solid #e8c0a8', lineHeight:1.5 }}>{a}</div>
              ))}
            </div>
          )}

          {/* Carb cravings note, menstrual only, collapsible */}
          {phaseKey === 'Menstrual' && (
            <div style={{ background:'#fff4f0', border:'1px solid #e8cfc8', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
              <div onClick={() => setShowCravings(!showCravings)}
                style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <i className="ti ti-info-circle" style={{ color:'#c89080', fontSize:16, flexShrink:0 }} />
                <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#2c2820' }}>Why you are craving carbs right now</div>
                <i className={`ti ti-chevron-${showCravings?'up':'down'}`} style={{ color:'#9a9590', fontSize:14 }} />
              </div>
              {showCravings && (
                <div style={{ padding:'0 14px 14px', borderTop:'1px solid #e8cfc8' }}>
                  <div style={{ fontSize:13, color:'#4a2a20', lineHeight:1.75, marginBottom:8 }}>
                    Estrogen is at its lowest point in your cycle. Estrogen directly improves how well your body uses blood sugar. When it drops, your cells become temporarily less responsive to insulin and your body compensates by craving quick glucose.
                  </div>
                  <div style={{ fontSize:13, color:'#4a2a20', lineHeight:1.75, marginBottom:6 }}>
                    <strong>What actually helps:</strong> complex carbohydrates paired with protein. Sweet potato with Greek yogurt, oats with eggs, rice with fish. The protein slows glucose absorption and reduces the insulin spike while meeting the metabolic demand.
                  </div>
                  <div style={{ fontSize:11, color:'#9a6058', lineHeight:1.5 }}>
                    Mauvais-Jarvis et al. (2013). Journal of Clinical Investigation.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fasting warning, all phases */}
          <div style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
            <div onClick={() => setShowFasting(!showFasting)}
              style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <i className="ti ti-alert-circle" style={{ color:'#c8b89a', fontSize:16, flexShrink:0 }} />
              <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#2c2820' }}>A note on intermittent fasting</div>
              <i className={`ti ti-chevron-${showFasting?'up':'down'}`} style={{ color:'#9a9590', fontSize:14 }} />
            </div>
            {showFasting && (
              <div style={{ padding:'0 14px 14px', borderTop:'1px solid #ede8e0' }}>
                <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.7, marginBottom:6 }}>
                  Intermittent fasting and skipping breakfast can backfire for women. Research suggests fasting raises cortisol in women differently than in men and can disrupt the hormonal signals that regulate your cycle.
                </div>
                <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.7, marginBottom:8 }}>
                  Eating within 30 to 60 minutes of waking supports cortisol rhythm. This is especially important in the luteal phase, when progesterone and cortisol are already competing in your stress hormone system and everything is under more load.
                </div>
                <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.5 }}>
                  Sims & Yeager (2024). ROAR (Rev. ed.). Rodale. / Hamadeh et al. (2005). Journal of Clinical Endocrinology and Metabolism, 90(6), 3592 to 3599.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding:'0 16px' }}>
          <div style={{ fontSize:12.5, color:'#7a7268', lineHeight:1.6, marginBottom:12 }}>
            Tap a symptom for food-based relief, each backed by research. These help alongside, never instead of, your usual care.
          </div>
          {SYMPTOMS.map(s => (
            <div key={s.id} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:10, overflow:'hidden' }}>
              <div onClick={() => setOpenSymptom(openSymptom===s.id ? null : s.id)}
                style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                <span style={{ fontSize:20 }}>{s.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                  <div style={{ fontSize:11, color:'#9a9590' }}>{s.sub}</div>
                </div>
                <i className={`ti ti-chevron-${openSymptom===s.id?'up':'down'}`} style={{ color:'#9a9590' }} />
              </div>
              {openSymptom===s.id && (
                <div style={{ padding:'12px 16px 14px', borderTop:'1px solid #f0ece4' }}>
                  {s.remedies.map((r, ri) => {
                    const last = ri === s.remedies.length - 1
                    return (
                      <div key={r.name} style={{ marginBottom:last?0:12, paddingBottom:last?0:12, borderBottom:last?'none':'1px solid #f5f0e8' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#2c2820', marginBottom:3 }}>{r.name}</div>
                        <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.6 }}>{r.why}</div>
                      </div>
                    )
                  })}
                  {s.avoid.length > 0 && (
                    <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #f0ece4' }}>
                      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Limit</div>
                      {s.avoid.map(a => (
                        <div key={a} style={{ fontSize:12, color:'#7a4a30', marginBottom:3, paddingLeft:8, borderLeft:'2px solid #e8c0a8' }}>{a}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer, concise; covers allergens, ED safety, and supplements */}
      <div style={{ fontSize:10, color:'#b0a89a', lineHeight:1.5, textAlign:'center', padding:'10px 20px 0' }}>
        Wellness guidance, not medical advice. Skip any food you are allergic to; targets are guides, not rules. If you are pregnant, have a medical condition, or a history of disordered eating, talk to your doctor or dietitian first.
      </div>

      {/* APA References */}
      <div style={{ margin:'10px 16px 0', border:'1px solid #ede8e0', borderRadius:12, overflow:'hidden' }}>
        <div onClick={() => setShowRefs(!showRefs)}
          style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:'#fff' }}>
          <i className="ti ti-book-2" style={{ color:'#9a9590', fontSize:15, flexShrink:0 }} />
          <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#2c2820' }}>References</div>
          <i className={`ti ti-chevron-${showRefs?'up':'down'}`} style={{ color:'#9a9590', fontSize:14 }} />
        </div>
        {showRefs && (
          <div style={{ padding:'10px 14px 14px', borderTop:'1px solid #ede8e0', background:'#faf8f5' }}>
            {APA_REFS.map((ref, i) => (
              <div key={i} style={{ fontSize:11, color:'#7a7268', lineHeight:1.7, marginBottom:10, paddingBottom:10, borderBottom: i < APA_REFS.length - 1 ? '1px solid #ede8e0' : 'none' }}>
                {i + 1}. {ref}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Update stats sheet */}
      {showUpdateSheet && <>
        <div onClick={() => setShowUpdateSheet(false)} style={{ position:'fixed', inset:0, background:'rgba(44,40,32,0.4)', zIndex:200 }} />
        <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, background:'#faf8f5', borderRadius:'20px 20px 0 0', zIndex:201, padding:'16px 20px 48px' }}>
          <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 16px' }} />
          <div style={{ fontSize:16, fontWeight:600, marginBottom:20 }}>Update your stats</div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:6 }}>Body weight (kg)</div>
            <input type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)}
              placeholder={profile?.body_weight_kg || 'e.g. 65'}
              style={{ width:'100%', padding:'12px', border:'1px solid #ede8e0', borderRadius:10, fontSize:15, fontFamily:'inherit', color:'#2c2820', background:'#fff', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:8 }}>Fitness level</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {['beginner','intermediate','advanced'].map(f => (
                <button key={f} onClick={() => setEditFitness(f)} style={{
                  padding:'10px 6px', borderRadius:10, border:`1px solid ${editFitness===f?'#c8b89a':'#ede8e0'}`,
                  background:editFitness===f?'#e8dfd0':'#fff', cursor:'pointer',
                  fontSize:12, fontWeight:editFitness===f?600:400,
                  color:editFitness===f?'#5a4a3a':'#2c2820', fontFamily:'inherit', textTransform:'capitalize',
                }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:8 }}>Dietary preference</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {DIET_OPTIONS.map(d => {
                const isActive = d.val === null ? editDiets.length === 0 : editDiets.includes(d.val)
                return (
                  <button key={String(d.val)} onClick={() => {
                    if (d.val === null) { setEditDiets([]); return }
                    // Gluten-free and dairy-free are dietary restrictions, they can combine with
                    // each other but not with a base diet. Every base diet is mutually exclusive.
                    const ADDONS = ['gluten_free', 'dairy_free']
                    const isAddon = ADDONS.includes(d.val)
                    setEditDiets(prev => {
                      const has = prev.includes(d.val)
                      if (isAddon) {
                        const addonsOnly = prev.filter(x => ADDONS.includes(x))
                        return has ? addonsOnly.filter(x => x !== d.val) : [...addonsOnly, d.val]
                      }
                      return has ? [] : [d.val]
                    })
                  }} style={{
                    padding:'8px 12px', borderRadius:10, border:`1px solid ${isActive?'#c8b89a':'#ede8e0'}`,
                    background:isActive?'#e8dfd0':'#fff', cursor:'pointer',
                    fontSize:12, fontWeight:isActive?600:400,
                    color:isActive?'#5a4a3a':'#2c2820', fontFamily:'inherit',
                  }}>{d.label}</button>
                )
              })}
            </div>
          </div>

          <button onClick={saveStats} disabled={savingStats} style={{ width:'100%', padding:'14px', borderRadius:12, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            {savingStats ? 'Saving...' : 'Save'}
          </button>
        </div>
      </>}
    </div>
  )
}
