
const fs = require('fs');
const content = fs.readFileSync('src/i18n/translations.ts', 'utf8');

const keysUsed = [
  "ai", "aiAllPairsFound", "aiAnswer", "aiBackToCourse", "aiBot", "aiCard", 
  "aiChallengeIdMissing", "aiClassicModeFlashcardTip", "aiClassicModeMemoryTip", 
  "aiClassicModeQuizTip", "aiClassicTrackInformatics", "aiClassicTrackPython", 
  "aiClassicTrackWeb", "aiCongratulations", "aiCorrectLine", "aiExplanation", 
  "aiFindBugHint", "aiGameDescriptionFindBug", "aiGameDescriptionFlashcardTrack", 
  "aiGameDescriptionGuessOutput", "aiGameDescriptionMemoryTrack", 
  "aiGameDescriptionQuizTrack", "aiGameDescriptionSpeedCode", "aiGeneratedBy", 
  "aiGoToCourse", "aiGuessOutputHint", "aiJoining", "aiLevelBeginner", 
  "aiLevelExpert", "aiLevelIntermediate", "aiLevelLabel", "aiMemoryAccuracy", 
  "aiMemoryFindPairs", "aiMetric", "aiPassedTopicsRequirement", 
  "aiPerfectScoreBonus", "aiRecommendations", "aiRecommendedTopicsToReview", 
  "aiResultCorrect", "aiResultQuestion", "aiResultWrong", "aiRetry", 
  "aiSecondsShort", "aiSpeedCodeHint", "aiSpeedUnit", "aiStarting", 
  "aiStrategyBonus", "aiStudentVsAiMetrics", "aiThinkingSpeed", "aiTime", 
  "aiTimeUp", "aiTopicCybersecurity", "aiTopicLabel", "aiTotal", "aiUser", 
  "aiViewAgain", "aiVsStudent", "aiWaitAnswer", "aiWon", "aiYouWon"
];

const missing = [];
keysUsed.forEach(key => {
  if (!content.includes(key + ':')) {
    missing.push(key);
  }
});

console.log("Missing keys:");
console.log(JSON.stringify(missing, null, 2));
