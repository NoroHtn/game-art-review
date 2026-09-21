export const sections = [
  ['brief','Concept & brief','Idea, audience, differentiation'],
  ['art-direction','Art direction','References, palette, typography'],
  ['character-concept','Characters','Cow, farmer, alien, UFO'],
  ['environment','Environment','Background and composition'],
  ['final-ui','Game screens','Desktop and mobile'],
  ['states','UI & states','29 final Figma screens'],
  ['animation','Motion','Five-second setup and flight'],
  ['production','Production','Team, schedule and risks'],
  ['deliverables','Deliverables','Figma, PDF and handoff']
];

export const references = [
  {file:'01-street-composition.jpg',source:'IMG_4591.jpeg',title:'Staging & depth',note:'Foreground silhouettes, a clear focal group and quieter background values keep a busy scene legible.',alt:'Black-and-white cartoon street scene with characters, a lamp and a vintage car'},
  {file:'02-cartoon-staging.jpg',source:'IMG_4589.jpeg',title:'Elastic performance',note:'A strong line of action, expressive faces and suspended poses give the scene its comic energy.',alt:'Monochrome cartoon van surrounded by ghosts and expressive woodland characters'},
  {file:'03-silhouette-language.jpg',source:'IMG_4587.jpeg',title:'Readable silhouettes',note:'Large black-and-light shapes and economical facial features remain clear at small sizes.',alt:'Vintage blue-gray cartoon scene with a ghost and stylized characters'},
  {file:'04-ink-and-print.jpg',source:'IMG_4592.jpeg',title:'Ink & print character',note:'Bold contour, soft print texture and restrained accent colors inform the finish—not the characters or branding.',alt:'Sepia illustrated devil and cup characters around a soul contract, with small red and blue accents'},
  {file:'05-cow-gesture.jpg',source:'IMG_4597.jpeg',title:'Cow gesture',note:'Rubber-hose limbs and a simple comic silhouette guide gesture studies. Keep our anatomy and poses original.',alt:'Small black-and-white vintage drawing of a cow beside a musician'},
  {file:'06-cow-construction.jpg',source:'IMG_4596.jpeg',title:'Cow construction',note:'A broad muzzle, distinct patches and separated limbs establish the cow as the scene’s readable main character.',alt:'Cream and black cartoon cow with a broad muzzle and clearly separated legs'}
];

export const evidence = [
  {title:'Idea, theme & audience',detail:'Concept, audience hypothesis and differentiation',href:'/game-art-review/brief/',status:'Available'},
  {title:'Style & visual principles',detail:'Six references, color logic and type treatment',href:'/game-art-review/art-direction/',status:'Available'},
  {title:'Main game screen',detail:'Desktop and mobile hierarchy, UI and usability',href:'/game-art-review/final-ui/',status:'Prototype'},
  {title:'Task breakdown & milestones',detail:'Deliverables, dependencies and review gates',href:'/game-art-review/production/#milestones',status:'Proposed'},
  {title:'Team workload & timeline',detail:'UI, 2D art and Spine effort across 15 working days',href:'/game-art-review/production/#workload',status:'Proposed'},
  {title:'Risks & mitigation',detail:'Named risks, responses and responsible roles',href:'/game-art-review/production/#risks',status:'Proposed'},
  {title:'Presentation PDF & Figma',detail:'Figma game section and final screen exports',href:'/game-art-review/deliverables/#figma',status:'Available'}
];

export const instantNeeds = {
  brief:['Game name and selected mechanic','Idea and theme','Target audience hypothesis','Differentiation from comparable games'],
  'art-direction':['Moodboard with source labels','Visual principles','Palette and value study','Display and interface typography'],
  'character-concept':['Character and object inventory','Model, pose and expression boards','Readable silhouettes','Production-layer requirements'],
  environment:['Background and props','Desktop composition','Mobile composition','Focal areas and UI-safe space'],
  'final-ui':['Main desktop screen','Main mobile screen','Visual hierarchy','Interaction and usability notes'],
  states:['Ready, active and result states','Loading and disabled states','Success and error feedback','Control and component inventory'],
  animation:['Sequence and timings','Key poses and transitions','Spine layer and pivot requirements','Reduced-motion behavior'],
  production:['Task breakdown and dependencies','UI, 2D and Spine workload','Milestones and timeline','Risks, mitigations and owners'],
  deliverables:['Figma presentation link','Matching PDF presentation','Named source assets','Export and handoff checklist']
};
