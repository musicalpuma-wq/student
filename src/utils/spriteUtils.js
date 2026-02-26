// Utility to define sprite sheet coordinates and mappings for the custom animal mascots 
// The custom sprite sheets generated have 5 expressions in a single horizontal row.

export const mascotConfigs = {
  dog: {
    src: '/src/assets/mascots/dog_expressions_1772072192837.png',
    frameWidth: 204, // 1024 / 5 rounded roughly, actually we can just use CSS background-position percentages
    frameHeight: 204
  },
  bear: {
    src: '/src/assets/mascots/bear_expressions_1772072389607.png',
  },
  fox: {
    src: '/src/assets/mascots/fox_expressions_1772072479181.png',
  }
};

// Returns the background-position percentage for a sprite sheet with 5 items in a single row
export const getExpressionPosition = (avgScore) => {
  if (avgScore >= 4.5) return '0%';      // Index 0: Starry eyes/Happy
  if (avgScore >= 3.5) return '25%';     // Index 1: Smiling
  if (avgScore >= 3.0) return '50%';     // Index 2: Neutral
  if (avgScore >= 2.0) return '75%';     // Index 3: Crying
  return '100%';                         // Index 4: Angry
};

export const getMascotAnimationClass = (avgScore) => {
    if (avgScore >= 4.5) return 'mascot-excellent'; 
    if (avgScore >= 3.5) return 'mascot-good'; 
    if (avgScore >= 3.0) return 'mascot-fair'; 
    if (avgScore >= 2.0) return 'mascot-poor'; 
    return 'mascot-fail'; 
};

export const getAssignedAnimal = (courseName) => {
    const animals = ['dog', 'bear', 'fox'];
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
        hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % animals.length;
    return animals[index];
};
