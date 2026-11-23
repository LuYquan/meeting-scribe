export interface SampleTranscript {
  id: string;
  title: string;
  description: string;
  transcript: string;
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    id: "sprint-planning",
    title: "Sprint Planning — Atlas Mobile App",
    description: "Short planning meeting. Routes on-device in Auto mode.",
    transcript: `Maya: Good morning, everyone. Sprint 14 planning — we have two weeks, ending Friday, November 28. Let's start with the backlog. Top item is offline mode for the field checklist. Jordan, how big is that?

Jordan: The checklist screen needs to work with no signal, then sync when we're back online. I estimate five points, mostly local storage and a sync queue. The tricky part is conflict handling if two people edit the same item.

Priya: The API already returns a version number per item, so the client can detect conflicts. I can add a last-write-wins rule with a warning banner this week. That is two points on my side.

Maya: Good. So offline mode is seven points total. Next: the new onboarding flow. Sam, where are we on the designs?

Sam: The three-step onboarding is ready in Figma. One open question: do we ask for notification permission on step two or step three? My recommendation is step three, after the user has seen value. Otherwise opt-in rates drop.

Jordan: Agreed, step three. I'll build it as designed — three points.

Maya: Let's lock that in. Decision: notification permission moves to step three of onboarding. Next, the bug backlog. The crash on Android 12 when rotating the camera — Priya, is that fixed?

Priya: Yes, fixed in yesterday's build, version 2.4.1. It was a null pointer in the image pipeline. I'll monitor crash reports this week.

Maya: Great. Now capacity: Jordan, you mentioned Thursday is a public holiday for you?

Jordan: Yes, I'm out Thursday. So my capacity is eight points, not thirteen.

Maya: Understood. Let's commit: offline mode at seven points, onboarding at three points, and the settings redesign at five points. That's fifteen total, which fits. Priya, can you take the settings API changes?

Priya: Yes, I'll have the endpoints ready by Wednesday, November 26.

Sam: And I'll deliver the final settings mockups by Tuesday, November 25.

Maya: Perfect. Action items: Jordan builds offline mode and onboarding, due Friday, November 28. Priya delivers settings endpoints by Wednesday, November 26. Sam delivers settings mockups by Tuesday, November 25. I'll send the sprint summary to the team today. Any blockers? No? Then we're done — thanks, everyone.`,
  },
  {
    id: "client-onboarding",
    title: "Client Onboarding Kickoff — Northwind Retail",
    description: "Kickoff with an external client. Routes on-device in Auto mode.",
    transcript: `Maya: Welcome, everyone, and thanks for joining the Northwind kickoff. I'm Maya, project lead. With me are Jordan from engineering and Priya from data. From Northwind we have Daniel, the operations director, and Sofia, the store systems manager. Goal for today: agree on the rollout plan for the inventory app across your twelve stores.

Daniel: Thanks, Maya. Our biggest pain is stock counts. Right now each store counts by hand on Sundays, and the numbers are wrong about twenty percent of the time. We need the app live before the holiday rush, so mid-December at the latest.

Sofia: Two things from our side. First, our handheld scanners run Android 10, so the app must support that. Second, our Wi-Fi in the back rooms is unreliable — the app has to work offline and sync later.

Jordan: Android 10 is fine, we support back to Android 9. Offline mode is already on our roadmap — the app queues scans locally and syncs when connectivity returns. That will be in the first release.

Priya: For the data side, we need a product export from your system. A nightly CSV with SKU, name, current stock, and price would be enough to start. Can you provide that, Sofia?

Sofia: Yes, our system can export CSV every night at 2 a.m. I'll send a sample file by Friday, November 28.

Maya: Great. Decision: we will launch with the CSV import for product data, and revisit a live API integration in phase two. Daniel, does mid-December work if we start the pilot in two stores first?

Daniel: A two-store pilot is smart. Let's pilot in the downtown and Riverside stores starting Monday, December 1, then roll out to the other ten stores by December 15, assuming the pilot goes well.

Maya: Agreed. Training: Sofia, how many staff per store need training?

Sofia: About six per store, so seventy-two people total. We can do one remote session per store, thirty minutes each.

Jordan: I'll record a five-minute training video too, so new staff can catch up without another session.

Maya: Action items: Sofia sends the sample product CSV by Friday, November 28. Priya builds the CSV import by Wednesday, December 3. Jordan delivers the offline-capable build for the pilot by Friday, November 28. I'll send the pilot checklist and the training schedule by tomorrow. Daniel will confirm the two pilot stores by end of day today.

Daniel: Downtown and Riverside are confirmed — you can put that in writing.

Maya: Excellent. One more decision: the pilot success bar is a stock-count error rate under five percent, measured after one week. If we hit that, we roll out to all twelve stores. Anything else? No? Thank you all — let's make this work.`,
  },
  {
    id: "incident-review",
    title: "Incident Review — Checkout Outage, Nov 14",
    description: "Longer postmortem. Routes to the cloud in Auto mode.",
    transcript: `Maya: Thanks for joining the incident review for the checkout outage on Friday, November 14. This is a blameless review — we are here to understand what happened and fix the system, not to point fingers. Timeline first. Priya, can you walk us through it?

Priya: Sure. At 10:42 a.m., the payment service started returning 500 errors. Our alerting fired at 10:47, five minutes later, because the alert threshold needed three consecutive failed checks. Jordan was on call and acknowledged the page at 10:51. He found the database connection pool was exhausted — the checkout service had opened over two thousand connections after a deploy that morning.

Jordan: Right. The 9:30 deploy added a retry loop to the payment client. Under normal load it was fine, but when the payment provider slowed down, every request retried three times, each retry holding a connection. The pool hit its limit of five hundred within twelve minutes, and then everything behind checkout started failing.

Maya: And the customer impact?

Priya: Checkout was down from 10:42 to 11:35 — fifty-three minutes. About four thousand checkout attempts failed. We estimate roughly six hundred orders were lost, around forty thousand dollars in revenue. The status page was updated at 11:05, which was too late — customers were already reporting it on social media by 10:55.

Sam: On the support side, we received about three hundred tickets in two hours. The team did not have a prepared message, so agents were writing individual replies. That slowed everything down.

Maya: Okay, let's talk about what went well first. The rollback worked — Jordan rolled back the deploy at 11:20, and the error rate dropped within five minutes. The database recovered on its own once the connections drained. And the on-call handoff was clean.

Jordan: What went wrong: first, the retry loop had no backoff and no circuit breaker. Second, our load test never simulated a slow payment provider — it only tested a fast one. Third, the alert threshold was too slow; five minutes of failed checkouts before paging is too long. Fourth, the status page update was manual and late.

Priya: I agree on all four. I'd add a fifth: the connection pool has no per-service limit, so one bad service can starve the others.

Maya: Decisions. One: we add exponential backoff and a circuit breaker to every external call — Jordan, that's yours. Two: we lower the alert threshold to page after one minute of checkout errors, not five. Three: the status page gets an automatic update when the checkout error rate crosses two percent. Four: load tests must include a slow-dependency scenario before any deploy touching the payment path.

Jordan: For the circuit breaker, I'll use the library we already have in the inventory service. I can have it in place by Friday, November 21. The load test scenario will take longer — I need to build a slow-provider stub. I'll aim for Wednesday, November 26.

Priya: I'll take the alert threshold change and the automatic status page update. Both are small — I can ship them by Wednesday, November 19.

Sam: I'll write the support holding message templates so the team has approved replies ready. I'll have a draft by tomorrow, and the final version by Friday, November 21.

Maya: Action items: Jordan implements backoff plus circuit breaker by Friday, November 21, and the slow-dependency load test by Wednesday, November 26. Priya ships the faster alerting and automatic status page updates by Wednesday, November 19. Sam delivers support message templates by Friday, November 21. I'll schedule a follow-up review in two weeks to confirm all fixes are live.

Priya: Before we close, one more thing on detection. The five-minute alert delay happened because the check runs every minute and needs three failures in a row. If we switch to a thirty-second check with a two-failure threshold, we'd page in about a minute. The risk is more false pages, but checkout is our revenue path — I'd rather page early.

Jordan: Agreed. And we should also add a dashboard panel for connection pool usage per service, so the next time a pool starts growing we see it before it hits the limit. That panel is half a day of work — I can add it to the same change as the circuit breaker.

Maya: Good, let's do that. Also, the payment provider: did anyone talk to them about the slowdown?

Jordan: I called their support at noon. They confirmed a partial outage on their side between 10:30 and 11:15 — elevated latency on card authorizations. They have a status page too, but we don't monitor it. If we had, we'd have known at 10:35 that the problem was upstream, not ours.

Priya: That's a good catch. I'll add their status feed to our monitoring, plus a rule: if the provider reports degraded performance, we automatically switch checkout into a degraded mode that queues payments instead of failing them.

Sam: From the customer side, we should also think about compensation. Six hundred lost orders is significant. Marketing is preparing a ten-percent discount code for affected customers. I'll coordinate with them so the support team uses the same message.

Maya: Decisions, then: five, we add the provider status feed to monitoring and a degraded-mode switch for checkout. Six, support will use the approved discount code message for affected customers. Priya, the monitoring work is yours — can you have it by Friday, November 21 as well?

Priya: The status feed integration is small, yes — Friday, November 21. The degraded-mode switch is bigger; it needs product approval. I'll write the proposal by Monday, November 24, and we can decide in the next planning meeting.

Maya: Perfect. Final action items: Jordan adds the connection pool dashboard panel by Friday, November 21. Priya integrates the provider status feed by Friday, November 21, and writes the degraded-mode proposal by Monday, November 24. Sam coordinates the discount code messaging with marketing by Wednesday, November 19. I'll send the written incident report to leadership by tomorrow, and book the follow-up review for Friday, December 5. Anything else? Thanks, everyone — good discussion.`,
  },
];
