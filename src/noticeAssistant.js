import { createLocalSummary } from "./summary.js";

const STOP_WORDS = new Set([
  "a", "about", "all", "an", "and", "are", "do", "for", "from", "give",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "show",
  "tell", "the", "there", "to", "what", "when", "where", "which", "who",
  "with", "you", "your",
]);
const INTENT_WORDS = new Set([
  "coming", "date", "dates", "deadline", "deadlines", "due", "key",
  "important", "next", "notice", "notices", "overview", "points", "soon",
  "summary", "summarise", "summarize", "task", "tasks", "todo", "to-do",
  "up", "upcoming",
]);

const ACTION_PATTERN =
  /\b(assign(?:ment)?s?|task|todo|to-do|submit|submission|due|deadline|required|must|bring|complete|register|apply)\b/i;
const DATE_PATTERN =
  /\b(date|deadline|due|exam|event|schedule|on|by|before|after|until|from|at|january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{1,2}(?:st|nd|rd|th)?\b/i;

function getQuestionTerms(question) {
  return (question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (word) => word.length > 1 && !STOP_WORDS.has(word) && !INTENT_WORDS.has(word),
  );
}

function getNoticeText(notice) {
  return [
    notice.title,
    notice.body,
    ...(Array.isArray(notice.summary) ? notice.summary : []),
  ]
    .filter(Boolean)
    .join(" ");
}

function getRelevantNotices(question, notices) {
  const terms = getQuestionTerms(question);
  const ranked = notices
    .map((notice) => {
      const text = getNoticeText(notice).toLowerCase();
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { notice, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score);

  return ranked.map(({ notice }) => notice);
}

function getSentences(notice) {
  return (notice.body.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getKeyPoints(notice) {
  const savedSummary = Array.isArray(notice.summary) ? notice.summary : [];
  return savedSummary.length ? savedSummary : createLocalSummary(notice.body);
}

function formatResult(notice, points) {
  return {
    title: notice.title,
    date: notice.date || "",
    points: [...new Set(points)].filter(Boolean).slice(0, 3),
  };
}

export function answerNoticeQuestion(question, notices, now = new Date()) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return {
      message: "Type a question about your saved notices to get started.",
      results: [],
    };
  }

  if (!notices.length) {
    return {
      message: "I can't find that information because there are no notices saved on this device yet.",
      results: [],
    };
  }

  const lowerQuestion = cleanQuestion.toLowerCase();
  const isSummaryQuestion =
    /\b(summary|summarize|summarise|key points|overview|explain)\b/.test(lowerQuestion);
  const isDateQuestion =
    /\b(date|dates|when|deadlines?|due|exams?|events?|schedule)\b/.test(lowerQuestion);
  const isTaskQuestion =
    /\b(task|tasks|todo|to-do|assignment|assignments|submit|submission|deadlines?|upcoming|coming up)\b/.test(
      lowerQuestion,
    );
  const isUpcomingQuestion = /\b(upcoming|coming up|next|soon)\b/.test(lowerQuestion);

  let relevantNotices = getRelevantNotices(cleanQuestion, notices);
  if (
    !relevantNotices.length &&
    !getQuestionTerms(cleanQuestion).length &&
    (isDateQuestion || isTaskQuestion || isSummaryQuestion)
  ) {
    relevantNotices = notices;
  }
  if (!relevantNotices.length) {
    return {
      message: "I couldn't find that topic in your saved notices. Try a notice title, subject, or keyword.",
      results: [],
    };
  }

  if (isSummaryQuestion) {
    const results = relevantNotices
      .map((notice) => formatResult(notice, getKeyPoints(notice)))
      .filter((result) => result.points.length);
    return results.length
      ? { message: "Here are the locally extracted key points from your saved notices:", results }
      : {
          message: "I couldn't find summary details for that topic in your saved notices.",
          results: [],
        };
  }

  if (isDateQuestion || isTaskQuestion) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const futureDated = relevantNotices.filter(
      (notice) =>
        notice.date &&
        new Date(`${notice.date}T23:59:59`).getTime() >= today,
    );
    const noticesToUse =
      isUpcomingQuestion && futureDated.length ? futureDated : relevantNotices;
    const results = noticesToUse
      .map((notice) => {
        const matchingSentences = getSentences(notice).filter((sentence) =>
          isDateQuestion && !isTaskQuestion
            ? DATE_PATTERN.test(sentence)
            : ACTION_PATTERN.test(sentence) ||
              (isDateQuestion && DATE_PATTERN.test(sentence)),
        );
        const points = matchingSentences.length
          ? matchingSentences
          : getKeyPoints(notice).filter((point) =>
              isTaskQuestion ? ACTION_PATTERN.test(point) : DATE_PATTERN.test(point),
            );
        return formatResult(notice, points);
      })
      .filter((result) => result.date || result.points.length);

    if (!results.length) {
      return {
        message: "I couldn't find a relevant date or task in your saved notices.",
        results: [],
      };
    }

    const message =
      isUpcomingQuestion && !futureDated.length
        ? "I couldn't verify an upcoming date from the saved date fields. These matching details are copied from your notices:"
        : isDateQuestion && isTaskQuestion
          ? "Here are the saved dates and task details I found:"
          : isDateQuestion
            ? "Here are the date details I found in your saved notices:"
            : "Here are the task details copied from your saved notices:";

    return { message, results };
  }

  return {
    message: "I couldn't find that information in your saved notices. I can help with notice summaries, important dates, deadlines, and tasks.",
    results: [],
  };
}
