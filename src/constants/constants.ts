// constants.ts
export const GLOBAL_CHAT_ID = 0;

// Generic categories - used with Ollama to generate specific topics
export const CATEGORIES = [
  "អាហារ", // Food
  "ផ្លែឈើ", // Fruit
  "សត្វ", // Animal
  "បក្សី", // Bird
  "ត្រី", // Fish
  "ផ្កា", // Flower
  "ដើមឈើ", // Tree
  "យានជំនិះ", // Vehicle
  "កីឡា", // Sport
  "ទីកន្លែង", // Place
  "របស់របរ", // Object
  "ទឹក", // Water
  "ភ្លើង", // Fire
  "ដី", // Earth
  "ខ្យល់", // Wind
  "ព្រះអាទិត្យ", // Sun
  "ព្រះចន្ទ", // Moon
  "ប្រាសាទ", // Temple
  "ទន្លេ", // River
  "ភ្នំ", // Mountain
  "សមុទ្រ", // Ocean
  "ផ្លូវ", // Road
  "ផ្ទះ", // House
  "សៀវភៅ", // Book
  "តន្ត្រី", // Music
  "រាំ", // Dance
  "ភោជនីយដ្ឋាន", // Restaurant
  "ផ្សារ", // Market
];

// Specific topics - used as fallback when Ollama is disabled
export const BASE_TOPICS = [
  // Food - អាហារ
  "សាច់អាំង", // Grilled meat
  "សម្លកកូរ", // Khmer curry
  "នំបញ្ចុក", // Khmer noodles
  "បបរ", // Rice porridge
  "អាម៉ុក", // Steamed fish curry
  "ឆាក្តាម", // Stir-fried crab
  "បាយឆា", // Fried rice
  "មីឆា", // Fried noodles
  "ឆាខ្ចៅ", // Stir-fried morning glory
  "សម្លម្ជូរ", // Sour soup

  // Fruits - ផ្លែឈើ
  "ស្វាយ", // Mango
  "ចេក", // Banana
  "ល្ហុង", // Papaya
  "ម្នាស់", // Pineapple
  "ទំពាំងបារាំង", // Strawberry
  "ដូង", // Coconut
  "ក្រូច", // Orange
  "ទុរេន", // Durian
  "មង្ឃុត", // Mangosteen
  "ស្រកា", // Sugar palm fruit

  // Animals - សត្វ
  "ខ្លា", // Tiger
  "ដំរី", // Elephant
  "ស្វា", // Monkey
  "ឆ្កែ", // Dog
  "ឆ្មា", // Cat
  "គោ", // Cow
  "ជ្រូក", // Pig
  "ទា", // Duck
  "មាន់", // Chicken
  "ក្របី", // Buffalo

  // Fish - ត្រី
  "ត្រីឆ្លាញ់", // Snakehead fish
  "ត្រីរ៉ស់", // Tilapia
  "ត្រីកញ្ជ្រោង", // Catfish
  "ត្រីប្រា", // Carp
  "ត្រីកាហែ", // Climbing perch

  // Birds - បក្សី
  "ទាសេះ", // Crane
  "ក្អែក", // Crow
  "សេះ", // Heron
  "ទាពណ៌", // Peacock
  "សត្វក្ងោក", // Owl

  // Flowers - ផ្កា
  "ផ្កាឈូក", // Lotus
  "ផ្កាម្លិះ", // Jasmine
  "ផ្កាកុលាប", // Rose
  "ផ្កាឈូកស", // Water lily
  "ផ្កាឈូកពណ៌", // Colored lotus

  // Trees - ដើមឈើ
  "ដើមស្វាយ", // Mango tree
  "ដើមចេក", // Banana tree
  "ដើមដូង", // Coconut tree
  "ដើមត្នោត", // Sugar palm tree
  "ដើមល្ហុង", // Papaya tree

  // Vehicles - យានជំនិះ
  "ម៉ូតូ", // Motorcycle
  "ឡាន", // Car
  "ឡានក្រុង", // Bus
  "ឡានដឹកទំនិញ", // Truck
  "កង់", // Bicycle
  "ទូក", // Boat
  "យន្តហោះ", // Airplane

  // Sports - កីឡា
  "បាល់ទាត់", // Football/Soccer
  "បាល់បោះ", // Volleyball
  "បាល់បោះទឹក", // Water volleyball
  "កីឡាប្រដាល់", // Boxing
  "រត់", // Running
  "ហែលទឹក", // Swimming

  // Places - ទីកន្លែង
  "ប្រាសាទអង្គរវត្ត", // Angkor Wat
  "ទន្លេមេគង្គ", // Mekong River
  "ទន្លេសាប", // Tonle Sap Lake
  "ភ្នំពេញ", // Phnom Penh
  "ផ្សារធំថ្មី", // Central Market

  // Objects - របស់របរ
  "ទូរស័ព្ទ", // Mobile phone
  "កុំព្យូទ័រ", // Computer
  "ទូរទស្សន៍", // Television
  "ទូរទឹកកក", // Refrigerator
  "ម៉ាស៊ីនបោកខោអាវ", // Washing machine
  "កាបូប", // Bag
  "ស្បែកជើង", // Shoes
  "អាវ", // Shirt
  "ខោ", // Pants
  "មួក", // Hat
];
