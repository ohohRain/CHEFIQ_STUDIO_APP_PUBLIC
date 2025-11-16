// Unified mock recipe data for demo purposes
// Used across HomeScreen, ProfileScreen, CollectionDetailScreen, AIInspirationScreen, and RecipeFormScreen
// TODO: Replace with Firebase/backend API calls

export const MOCK_RECIPES = [
  {
    id: '1',
    title: 'Hand-Torn Cabbage',
    description: 'A classic Sichuan stir-fry dish featuring tender cabbage leaves torn by hand and cooked with aromatic spices',
    username: 'sichuan_chef',
    author: {
      username: 'sichuan_chef',
      avatar: null,
    },
    likeCount: 328,
    commentCount: 45,
    viewCount: 1200,
    imageSource: require('../../assets/demo_food_images/1.jpeg'),
    aspectRatio: 0.85,
    difficulty: 'Easy',
    cookingTime: 15,
    cuisine: 'Chinese',
    equipment: ['iQ Cooker - Multi-Cooker'],
    ingredients: [
      { name: 'Cabbage', amount: '1 head' },
      { name: 'Garlic', amount: '4 cloves' },
      { name: 'Dried red chilies', amount: '6 pieces' },
      { name: 'Sichuan peppercorns', amount: '1 tsp' },
      { name: 'Soy sauce', amount: '2 tbsp' },
      { name: 'Rice vinegar', amount: '1 tbsp' },
      { name: 'Salt', amount: 'to taste' },
    ],
    steps: [
      {
        number: 1,
        description: 'Tear the cabbage into bite-sized pieces by hand. Wash and drain thoroughly.',
        image: null,
      },
      {
        number: 2,
        description: 'Heat oil in wok over high heat. Add Sichuan peppercorns and dried chilies, stir-fry until fragrant.',
        image: null,
      },
      {
        number: 3,
        description: 'Add minced garlic and stir-fry for 30 seconds until aromatic.',
        image: null,
      },
      {
        number: 4,
        description: 'Add cabbage and stir-fry over high heat for 3-4 minutes until slightly wilted but still crispy.',
        image: null,
      },
      {
        number: 5,
        description: 'Season with soy sauce, rice vinegar, and salt. Toss well and serve immediately.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '2',
    title: 'Grilled Rib Eye Steak',
    description: 'A premium cut of beef with rich marbling, grilled to perfection for a tender and juicy result',
    username: 'steakmaster_pro',
    author: {
      username: 'steakmaster_pro',
      avatar: null,
    },
    likeCount: 567,
    commentCount: 89,
    viewCount: 2400,
    imageSource: require('../../assets/demo_food_images/2.jpeg'),
    aspectRatio: 1.1,
    difficulty: 'Medium',
    cookingTime: 30,
    cuisine: 'Western',
    equipment: ['iQ Grill', 'iQ Sense'],
    ingredients: [
      { name: 'Rib eye steak', amount: '500g' },
      { name: 'Olive oil', amount: '2 tbsp' },
      { name: 'Sea salt', amount: '1 tsp' },
      { name: 'Black pepper', amount: '1 tsp' },
      { name: 'Garlic', amount: '3 cloves' },
      { name: 'Fresh rosemary', amount: '2 sprigs' },
      { name: 'Butter', amount: '2 tbsp' },
    ],
    steps: [
      {
        number: 1,
        description: 'Remove steak from refrigerator 30 minutes before cooking. Pat dry with paper towels.',
        image: require('../../assets/demo_food_images/steak_step1.jpeg'),
      },
      {
        number: 2,
        description: 'Season both sides generously with sea salt and black pepper. Rub with olive oil.',
        image: null,
      },
      {
        number: 3,
        description: 'Preheat grill to high heat (230°C/450°F). Place steak on grill and cook for 4-5 minutes per side for medium-rare.',
        image: require('../../assets/demo_food_images/steak_step3.jpeg'),
      },
      {
        number: 4,
        description: 'Add butter, crushed garlic, and rosemary to the pan. Baste the steak with the melted butter for extra flavor.',
        image: null,
      },
      {
        number: 5,
        description: 'Remove from heat and let rest for 5 minutes before slicing. Serve with your favorite sides.',
        image: require('../../assets/demo_food_images/steak_step2.jpeg'),
      },
    ],
    status: 'published',
  },
  {
    id: '3',
    title: 'Middle Eastern Veggie Salad',
    description: 'A refreshing salad with fresh vegetables, chickpeas, and Mediterranean herbs tossed in lemon-tahini dressing',
    username: 'healthy_mezze',
    author: {
      username: 'healthy_mezze',
      avatar: null,
    },
    likeCount: 412,
    commentCount: 56,
    viewCount: 1800,
    imageSource: require('../../assets/demo_food_images/3.jpeg'),
    aspectRatio: 0.9,
    difficulty: 'Easy',
    cookingTime: 20,
    cuisine: 'Middle Eastern',
    equipment: [],
    ingredients: [
      { name: 'Chickpeas', amount: '1 can (400g)' },
      { name: 'Cherry tomatoes', amount: '200g' },
      { name: 'Cucumber', amount: '1 large' },
      { name: 'Red onion', amount: '1 small' },
      { name: 'Fresh parsley', amount: '1/2 cup' },
      { name: 'Tahini', amount: '3 tbsp' },
      { name: 'Lemon juice', amount: '2 tbsp' },
      { name: 'Olive oil', amount: '2 tbsp' },
    ],
    steps: [
      {
        number: 1,
        description: 'Drain and rinse chickpeas. Chop tomatoes, cucumber, and red onion into bite-sized pieces.',
        image: null,
      },
      {
        number: 2,
        description: 'Finely chop fresh parsley and add to a large mixing bowl with the vegetables.',
        image: null,
      },
      {
        number: 3,
        description: 'In a small bowl, whisk together tahini, lemon juice, olive oil, and a pinch of salt until smooth.',
        image: null,
      },
      {
        number: 4,
        description: 'Pour dressing over the salad and toss gently to combine. Let sit for 5 minutes to allow flavors to meld.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '4',
    title: 'Chicken Masala',
    description: 'A rich and aromatic Indian curry with tender chicken pieces in a creamy tomato-based sauce with authentic spices',
    username: 'curry_kingdom',
    author: {
      username: 'curry_kingdom',
      avatar: null,
    },
    likeCount: 698,
    commentCount: 102,
    viewCount: 3200,
    imageSource: require('../../assets/demo_food_images/4.jpeg'),
    aspectRatio: 1.2,
    difficulty: 'Medium',
    cookingTime: 45,
    cuisine: 'Indian',
    equipment: ['iQ Cooker - Multi-Cooker'],
    ingredients: [
      { name: 'Chicken thighs', amount: '600g' },
      { name: 'Onion', amount: '2 large' },
      { name: 'Tomatoes', amount: '3 large' },
      { name: 'Ginger-garlic paste', amount: '2 tbsp' },
      { name: 'Garam masala', amount: '2 tsp' },
      { name: 'Turmeric powder', amount: '1 tsp' },
      { name: 'Cumin powder', amount: '1 tsp' },
      { name: 'Heavy cream', amount: '1/2 cup' },
      { name: 'Fresh cilantro', amount: 'for garnish' },
    ],
    steps: [
      {
        number: 1,
        description: 'Cut chicken into bite-sized pieces. Marinate with yogurt, turmeric, and salt for 30 minutes.',
        image: null,
      },
      {
        number: 2,
        description: 'Heat oil in a pan. Sauté finely chopped onions until golden brown. Add ginger-garlic paste and cook for 2 minutes.',
        image: null,
      },
      {
        number: 3,
        description: 'Add chopped tomatoes and cook until they break down into a thick sauce, about 10 minutes.',
        image: null,
      },
      {
        number: 4,
        description: 'Add garam masala, cumin powder, and marinated chicken. Cook on medium heat for 20 minutes until chicken is fully cooked.',
        image: null,
      },
      {
        number: 5,
        description: 'Stir in heavy cream and simmer for 5 minutes. Garnish with fresh cilantro and serve with rice or naan.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '5',
    title: 'Butter Chicken',
    description: 'A creamy Indian curry with tender chicken in a rich tomato and butter sauce, flavored with aromatic spices',
    username: 'tandoori_master',
    author: {
      username: 'tandoori_master',
      avatar: null,
    },
    likeCount: 823,
    commentCount: 134,
    viewCount: 4100,
    imageSource: require('../../assets/demo_food_images/5.jpeg'),
    aspectRatio: 1.0,
    difficulty: 'Medium',
    cookingTime: 50,
    cuisine: 'Indian',
    equipment: ['iQ Cooker - Multi-Cooker'],
    ingredients: [
      { name: 'Chicken breast', amount: '700g' },
      { name: 'Butter', amount: '4 tbsp' },
      { name: 'Tomato puree', amount: '2 cups' },
      { name: 'Heavy cream', amount: '3/4 cup' },
      { name: 'Yogurt', amount: '1/2 cup' },
      { name: 'Garam masala', amount: '2 tsp' },
      { name: 'Kashmiri chili powder', amount: '1 tsp' },
      { name: 'Fenugreek leaves', amount: '1 tsp' },
      { name: 'Ginger-garlic paste', amount: '2 tbsp' },
    ],
    steps: [
      {
        number: 1,
        description: 'Marinate chicken pieces with yogurt, Kashmiri chili powder, and salt for at least 2 hours.',
        image: null,
      },
      {
        number: 2,
        description: 'Grill or pan-fry marinated chicken until slightly charred. Set aside.',
        image: null,
      },
      {
        number: 3,
        description: 'Melt butter in a pan. Add ginger-garlic paste and sauté for 1 minute until fragrant.',
        image: null,
      },
      {
        number: 4,
        description: 'Add tomato puree, garam masala, and fenugreek leaves. Simmer for 15 minutes until sauce thickens.',
        image: null,
      },
      {
        number: 5,
        description: 'Add grilled chicken and heavy cream. Simmer for 10 minutes. Garnish with cream swirl and serve hot.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '6',
    title: 'Strawberry Oreo Cake',
    description: 'A decadent dessert featuring layers of moist chocolate cake, crushed Oreos, and fresh strawberries with cream frosting',
    username: 'dessert_dreams',
    author: {
      username: 'dessert_dreams',
      avatar: null,
    },
    likeCount: 945,
    commentCount: 167,
    viewCount: 5600,
    imageSource: require('../../assets/demo_food_images/6.jpeg'),
    aspectRatio: 1.3,
    difficulty: 'Hard',
    cookingTime: 60,
    cuisine: 'Western',
    equipment: ['iQ Oven'],
    ingredients: [
      { name: 'Chocolate cake mix', amount: '1 box' },
      { name: 'Oreo cookies', amount: '20 pieces' },
      { name: 'Fresh strawberries', amount: '300g' },
      { name: 'Heavy cream', amount: '2 cups' },
      { name: 'Cream cheese', amount: '200g' },
      { name: 'Powdered sugar', amount: '1 cup' },
      { name: 'Vanilla extract', amount: '1 tsp' },
    ],
    steps: [
      {
        number: 1,
        description: 'Prepare chocolate cake according to package instructions. Bake in two 9-inch round pans. Let cool completely.',
        image: null,
      },
      {
        number: 2,
        description: 'Crush Oreo cookies into fine crumbs. Reserve some for topping.',
        image: null,
      },
      {
        number: 3,
        description: 'Whip heavy cream with powdered sugar and vanilla until stiff peaks form. Fold in softened cream cheese.',
        image: null,
      },
      {
        number: 4,
        description: 'Layer cake: place first cake layer, spread cream frosting, add crushed Oreos and sliced strawberries. Top with second cake layer.',
        image: null,
      },
      {
        number: 5,
        description: 'Frost entire cake with remaining cream. Decorate with whole strawberries and Oreo crumbs. Refrigerate for 2 hours before serving.',
        image: null,
      },
    ],
    status: 'draft',
  },
  {
    id: '7',
    title: 'Strawberry Cream Cake',
    description: 'A light and fluffy vanilla cake layered with fresh strawberries and whipped cream, topped with strawberry glaze',
    username: 'bakery_queen',
    author: {
      username: 'bakery_queen',
      avatar: null,
    },
    likeCount: 734,
    commentCount: 98,
    viewCount: 3800,
    imageSource: require('../../assets/demo_food_images/7.jpeg'),
    aspectRatio: 0.95,
    difficulty: 'Medium',
    cookingTime: 75,
    cuisine: 'Western',
    equipment: ['iQ Oven'],
    ingredients: [
      { name: 'All-purpose flour', amount: '2 cups' },
      { name: 'Sugar', amount: '1.5 cups' },
      { name: 'Eggs', amount: '4 large' },
      { name: 'Butter', amount: '1/2 cup' },
      { name: 'Fresh strawberries', amount: '500g' },
      { name: 'Heavy whipping cream', amount: '2 cups' },
      { name: 'Vanilla extract', amount: '2 tsp' },
      { name: 'Strawberry jam', amount: '1/2 cup' },
    ],
    steps: [
      {
        number: 1,
        description: 'Preheat oven to 180°C (350°F). Mix flour, sugar, eggs, butter, and vanilla to form smooth batter.',
        image: null,
      },
      {
        number: 2,
        description: 'Pour batter into greased cake pans. Bake for 25-30 minutes until golden and a toothpick comes out clean.',
        image: null,
      },
      {
        number: 3,
        description: 'Whip heavy cream until stiff peaks form. Slice strawberries into thin pieces.',
        image: null,
      },
      {
        number: 4,
        description: 'Layer cake: spread strawberry jam on first layer, add whipped cream and strawberry slices. Place second cake layer on top.',
        image: null,
      },
      {
        number: 5,
        description: 'Frost entire cake with whipped cream. Decorate with fresh strawberries and drizzle with strawberry glaze.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '8',
    title: 'Chinese Fish Soup',
    description: 'A light and nourishing soup with fresh fish in a clear broth, enhanced with ginger, scallions, and traditional Chinese seasonings',
    username: 'soup_specialist',
    author: {
      username: 'soup_specialist',
      avatar: null,
    },
    likeCount: 456,
    commentCount: 67,
    viewCount: 2100,
    imageSource: require('../../assets/demo_food_images/8.jpeg'),
    aspectRatio: 0.8,
    difficulty: 'Easy',
    cookingTime: 35,
    cuisine: 'Chinese',
    equipment: ['iQ Cooker - Multi-Cooker'],
    ingredients: [
      { name: 'Fresh fish fillet', amount: '400g' },
      { name: 'Ginger', amount: '5 slices' },
      { name: 'Scallions', amount: '3 stalks' },
      { name: 'Chicken broth', amount: '4 cups' },
      { name: 'Tofu', amount: '200g' },
      { name: 'White pepper', amount: '1/2 tsp' },
      { name: 'Salt', amount: 'to taste' },
      { name: 'Sesame oil', amount: '1 tsp' },
    ],
    steps: [
      {
        number: 1,
        description: 'Cut fish fillet into bite-sized pieces. Slice tofu into cubes. Julienne ginger and chop scallions.',
        image: null,
      },
      {
        number: 2,
        description: 'Bring chicken broth to a boil. Add ginger slices and simmer for 5 minutes to infuse flavor.',
        image: null,
      },
      {
        number: 3,
        description: 'Add tofu cubes and cook for 3 minutes. Then gently add fish pieces and cook for 5-7 minutes until fish is cooked through.',
        image: null,
      },
      {
        number: 4,
        description: 'Season with salt and white pepper. Add chopped scallions and drizzle with sesame oil. Serve hot.',
        image: null,
      },
    ],
    status: 'published',
  },
  {
    id: '9',
    title: 'Garlic Roasted Ribs',
    description: 'Tender pork ribs marinated in garlic and Chinese spices, then roasted until golden and fragrant',
    username: 'bbq_champion',
    author: {
      username: 'bbq_champion',
      avatar: null,
    },
    likeCount: 612,
    commentCount: 88,
    viewCount: 2900,
    imageSource: require('../../assets/demo_food_images/9.jpeg'),
    aspectRatio: 1.05,
    difficulty: 'Medium',
    cookingTime: 90,
    cuisine: 'Chinese',
    equipment: ['iQ Oven', 'iQ Cooker - Multi-Cooker'],
    ingredients: [
      { name: 'Pork ribs', amount: '1kg' },
      { name: 'Garlic', amount: '10 cloves' },
      { name: 'Soy sauce', amount: '3 tbsp' },
      { name: 'Oyster sauce', amount: '2 tbsp' },
      { name: 'Honey', amount: '2 tbsp' },
      { name: 'Chinese five-spice powder', amount: '1 tsp' },
      { name: 'Rice wine', amount: '2 tbsp' },
      { name: 'Ginger', amount: '3 slices' },
    ],
    steps: [
      {
        number: 1,
        description: 'Cut ribs into individual pieces. Blanch in boiling water for 5 minutes to remove impurities. Drain and pat dry.',
        image: null,
      },
      {
        number: 2,
        description: 'Mince garlic finely. Mix with soy sauce, oyster sauce, honey, five-spice powder, and rice wine to create marinade.',
        image: null,
      },
      {
        number: 3,
        description: 'Coat ribs thoroughly with marinade. Cover and refrigerate for at least 4 hours or overnight.',
        image: null,
      },
      {
        number: 4,
        description: 'Preheat oven to 200°C (400°F). Place ribs on baking tray lined with foil. Roast for 45 minutes, turning halfway.',
        image: null,
      },
      {
        number: 5,
        description: 'Brush with remaining marinade and increase heat to 220°C (425°F). Roast for 10 more minutes until caramelized and golden.',
        image: null,
      },
    ],
    status: 'draft',
  },
  {
    id: '10',
    title: 'Char Siu Pork',
    description: 'Classic Cantonese BBQ pork with a sweet and savory glaze, roasted until caramelized and tender',
    username: 'cantonese_cook',
    author: {
      username: 'cantonese_cook',
      avatar: null,
    },
    likeCount: 891,
    commentCount: 145,
    viewCount: 4500,
    imageSource: require('../../assets/demo_food_images/10.jpeg'),
    aspectRatio: 0.75,
    difficulty: 'Medium',
    cookingTime: 120,
    cuisine: 'Chinese',
    equipment: ['iQ Oven'],
    ingredients: [
      { name: 'Pork shoulder', amount: '1kg' },
      { name: 'Hoisin sauce', amount: '3 tbsp' },
      { name: 'Soy sauce', amount: '3 tbsp' },
      { name: 'Honey', amount: '3 tbsp' },
      { name: 'Chinese rose wine', amount: '2 tbsp' },
      { name: 'Red fermented tofu', amount: '2 cubes' },
      { name: 'Five-spice powder', amount: '1 tsp' },
      { name: 'Garlic', amount: '4 cloves' },
    ],
    steps: [
      {
        number: 1,
        description: 'Cut pork shoulder into long strips, about 2 inches thick. Pierce meat with fork to help marinade penetrate.',
        image: null,
      },
      {
        number: 2,
        description: 'Mash red fermented tofu. Mix with hoisin sauce, soy sauce, honey, rose wine, five-spice powder, and minced garlic.',
        image: null,
      },
      {
        number: 3,
        description: 'Coat pork strips thoroughly with marinade. Cover and refrigerate overnight (minimum 8 hours).',
        image: null,
      },
      {
        number: 4,
        description: 'Preheat oven to 180°C (350°F). Place pork on wire rack over baking tray. Roast for 30 minutes, basting with marinade every 10 minutes.',
        image: null,
      },
      {
        number: 5,
        description: 'Increase temperature to 220°C (425°F). Brush with honey glaze and roast for 10 more minutes until edges are caramelized. Let rest before slicing.',
        image: null,
      },
    ],
    status: 'published',
  },
];

// Helper function to get recipes by status
export const getRecipesByStatus = (status) => {
  if (status === 'all') return MOCK_RECIPES;
  return MOCK_RECIPES.filter((recipe) => recipe.status === status);
};

// Helper function to get published recipes only
export const getPublishedRecipes = () => {
  return MOCK_RECIPES.filter((recipe) => recipe.status === 'published');
};

// Helper function to get draft recipes only
export const getDraftRecipes = () => {
  return MOCK_RECIPES.filter((recipe) => recipe.status === 'draft');
};

// Helper function to get random recipes for recommendations
export const getRandomRecipes = (count = 3) => {
  const published = getPublishedRecipes();
  const shuffled = [...published].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
