/**
 * Compute confidence score for a ticket based on pattern matches.
 * - Subject match: +1 point
 * - Description match: +1 point
 * - Multiple pattern matches: +0.5 each (additional matches beyond first in that field)
 */
function scoreTicket(ticket, subjectPatterns, bodyPatterns) {
  let score = 0;
  const subject = (ticket.subject || '').toLowerCase();
  const description = (ticket.description || ticket.raw_subject || '').toLowerCase();

  let subjectMatchCount = 0;
  for (const pattern of subjectPatterns) {
    if (subject.includes(pattern.toLowerCase())) {
      subjectMatchCount++;
    }
  }
  if (subjectMatchCount > 0) {
    score += 1;
    score += (subjectMatchCount - 1) * 0.5;
  }

  let bodyMatchCount = 0;
  for (const pattern of bodyPatterns) {
    if (description.includes(pattern.toLowerCase())) {
      bodyMatchCount++;
    }
  }
  if (bodyMatchCount > 0) {
    score += 1;
    score += (bodyMatchCount - 1) * 0.5;
  }

  return score;
}

/**
 * Filter tickets by confidence thresholds.
 * Returns { toDelete, needsReview }:
 * - toDelete: tickets >= minConfidence (will be deleted)
 * - needsReview: tickets with score > 0 but < minConfidence (matched patterns but low confidence)
 */
function filterByConfidence(tickets, subjectPatterns, bodyPatterns, minConfidence) {
  const toDelete = [];
  const needsReview = [];
  for (const ticket of tickets) {
    const confidence = scoreTicket(ticket, subjectPatterns, bodyPatterns);
    if (confidence >= minConfidence) {
      toDelete.push({ ticket, confidence });
    } else if (confidence > 0) {
      needsReview.push({ ticket, confidence });
    }
  }
  return { toDelete, needsReview };
}

module.exports = { scoreTicket, filterByConfidence };
