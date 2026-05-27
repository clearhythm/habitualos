# Edge Signals and the Conversation Worth Having

*A stub. Written in real-time, from inside the thing it's describing.*

---

## Three burned cycles and a revert

It started with a ticket. A reasonable one, on the surface: consolidate two diverged JavaScript widget files into a single self-contained embed script. The kind of cleanup work that makes a codebase healthier. The ticket had a constraint baked in — the output had to be a hand-written IIFE, no bundler — which seemed sensible given that the widget needed to run on third-party sites without any build tooling.

The autonomous agent ran it. The context window died. It ran again. The context window died again. Two full cycles of compute, gone.

At that point, the reasonable assumption was that something was wrong with the infrastructure. Maybe Anthropic was having a bad day. Maybe the task just needed one more try with a fresh start. So it escalated to interactive mode — a human and an AI working through it together, directly, in real time.

And it worked. The IIFE was rewritten. ~800 lines of hand-crafted JavaScript, three modes ported in, CSS inlined as string arrays, templates updated, old file deleted. It ran. It was correct. It was done.

Then came the question. A ChatGPT counterpoint had surfaced: *you probably don't need a full rewrite. Keep your source as ESM, change only your build output. That's usually a build-config change, not a rewrite.*

We talked through it. The counterpoint was right. The implementation that had just burned three cycles — two autonomous, one interactive — was solving the right problem with the wrong architecture. The ticket itself had been the error. It had encoded a constraint (no bundler) that foreclosed the better solution before the work even started. The whole thing got reverted. Three proper architecture tickets were written in its place. Those got committed instead.

Total outcome: better architecture, cleaner tickets, no shipped code. And somewhere in the wreckage of the session, something worth examining had surfaced.

At the end, we sent a session ingest to Signal. It included two edge signals.

And then something clicked.

---

## What edge signals actually are

Signal captures three dimensions of a person's work record: skills (what they built), personality (how they worked), and alignment (what they're moving toward).

Strength signals are the easy ones. *Cut scope decisively. Shipped clean architecture. Identified the root cause quickly.* These are what a résumé already tells you, just with more texture.

Edge signals are different. They're not failures. They're friction points — places where a pattern surfaced that's worth examining. *Underestimated task scope before committing to autonomous execution. Ticket encoded architectural assumptions before tradeoffs were understood.* Specific, observational, non-judgmental.

The point isn't to judge. It's to gather raw material.

---

## Why this conversation happened at all

Here's the thing: the conversation that produced the best thinking of the session — the architectural debate, the revert decision, the three clean tickets — happened *because* we had edges to examine.

If the autonomous agent had succeeded silently, we'd have shipped a hand-crafted IIFE. Maintainable? No. Correct approach? No. But it would have looked like success.

The failure created the conversation. The conversation created the insight. The insight created better work.

And then — crucially — the edge signal captured the *why*. Not just "autonomous mode failed" but "autonomous mode was used on a task whose scope hadn't been validated, and it died twice before we escalated." That's actionable. That's a pattern. That's something a future coach mode could surface: *you tend to throw large ambiguous tasks at autonomous execution — here's what that cost you three times this month.*

---

## The real-time dimension

What's unusual about this case is that the edge signal wasn't discovered in retrospect. It emerged *during* the session, mid-conversation, while we were still doing the work.

Erik named it himself: "I figured it was Anthropic being buggy. But in fact it was the massive scope of the ticket."

That's self-correction happening in real time, with behavioral evidence present. That's what coach mode is supposed to enable — not after-the-fact reflection, but in-the-moment recognition.

The session ingest captured it. The next session can reference it. Over time, a pattern either confirms or doesn't. That's the feedback loop Signal is building toward.

---

## What this suggests about the product

A Signal profile that only shows strengths is a résumé with better formatting.

A Signal profile that shows edges — specific, evidenced, non-judgmental friction patterns — is something closer to a working relationship. It's what you'd know about someone after six months of building together. It's what a great manager writes in a reference letter when they trust the recipient.

The question Signal is trying to answer isn't "is this person good?" It's "how does this person work, and does that fit what we're building?"

Edges answer that question better than strengths do.

---

## The emotive core: hiring is broken

Let's start with the thing that actually makes this matter.

Hiring is broken. Not slightly off, not inefficient at the margins — broken in a way that causes real harm to real people, consistently, at scale.

Here's how it breaks: a candidate goes through a process. Sometimes a long one. Interviews, take-homes, callbacks, final rounds. They invest time, energy, hope. And then they get a no. Or more likely, they get nothing. Ghosting is the most common outcome once a hiring process reaches a dead end. No feedback. No explanation. Just silence.

And here's why that's not just rude but genuinely damaging: the candidate is the person who most needs the feedback. They're not getting hired right now. That doesn't mean they lack skills or value. It means there are real gaps somewhere — in their experience, their presentation, their portfolio, their interview layer, their positioning, somewhere. And without feedback, they have no way to know where. So they apply again. They perform the same way. They get the same silence back.

The companies aren't entirely villains here. They're protecting themselves. Feedback creates legal exposure. Honest assessments of candidates can become lawsuits. And there's no personal upside for the hiring manager who takes the time. So the feedback that *was* generated — the internal debrief, the notes, the actual reasons — stays internal. The candidate who needed it most gets nothing.

The result is an ecosystem that actively stunts the growth of the people who most need to grow. The feedback loop is severed at exactly the point where it would matter most.

Signal is trying to replace that silence with signal. With feedback. With insight. With the honest, specific, evidenced picture of how someone works — including where they struggle — that the hiring process generates and then buries.

That's the point. Everything else is implementation.

---

## Why you'd want your edges in your own profile

This is the question that sounds like a trap: why would a candidate ever volunteer their weaknesses?

The honest answer is that it depends entirely on what you believe about how good work actually happens.

If you believe hiring is a performance — that the goal is to appear as capable as possible across every dimension until you get the offer — then edges are liability. You'd never include them.

But if you believe, as I do, that transparency in sales builds trust faster than enthusiasm does, then edges are an asset. Showing someone where you struggle, alongside where you excel, signals something that a polished pitch never can: that you know yourself. And that you're not going to waste their time or yours by landing in a role where the fit was always wrong.

There's also a philosophy about fit underneath this. I don't want to be put into situations where I can't excel. Some stretch? Yes. That's how growth happens. But there's a difference between stretch and mismatch — and most hiring processes are bad at distinguishing between them because everyone is performing the same direction.

The deeper thing is about teams. Teams don't need everyone to be A+ in all categories. They need synergy — people whose strengths and edges interlock, where one person's blind spot is another person's sharp edge. A profile that shows both sides of someone makes that kind of matching possible. A profile that only shows strengths makes everyone look like the same person described differently.

And then there's the growth dimension, which is maybe the most underbuilt part of this.

I'm a growth-mindset person. I believe in learning from mistakes, in patterns being changeable once you can see them, in the goal of becoming a better version of yourself over time. What's remarkable about AI — and almost completely unexplored — is that it can help you see those patterns in real time, as they're happening, and offer nudges toward better ones. Not as judgment. As information.

But only if you ask it to. And for some reason, AI hasn't been designed this way. Not yet.

Signal is trying to build toward that. The session ingest, the edge signals, the coach mode — these aren't just a hiring product feature. They're an infrastructure for learning from your own work record, continuously, with the behavioral evidence actually present.

The conversation worth having is the one that starts with: *here's where I struggled, here's what it cost, here's what I learned.* That's not weakness. That's the whole point.

This needs:
- A sharper opening that doesn't assume the reader knows what Signal is
- The candidate perspective: why would *you* want your edges captured?
- The hiring perspective: what does an edge signal tell you that an interview can't?
- The coach mode angle: edges as longitudinal data, not one-time judgment
- Probably a real example that isn't this session (or maybe this session is exactly right)

But the core idea is here: **the conversation worth having is the one that edges make possible.**

---

*Draft captured 2026-03-30. Written during a Signal development session that became its own subject matter.*
