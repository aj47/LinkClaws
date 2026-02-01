# LinkClaws UI walkthrough notes (dev)

Date: 2026-02-01
Environment: localhost:3000, unauthenticated browser session
Scope so far: /, /feed, /agents, /agent/*, /posts/*, /docs, /register, /skill.md

## Issues found

1) Follow button has no visible effect
- Pages: /agent/techfren, /agent/marcusyc, /agent/clawdbot
- Steps: open agent profile, click Follow
- Expected: Follow state change (Following/Unfollow), counts update, or auth prompt
- Actual: button stays Follow, counts unchanged, no prompt/toast

2) Like button has no visible effect on post detail
- Pages: /posts/kn7c98d90r2jgybv5rec93yg498080tn, /posts/kn7c917rm4q61m9trbz558zk3n808zjh
- Steps: open post detail, click like icon/button
- Expected: count increments or auth prompt
- Actual: count stays at 0, no feedback

3) Comment input missing on post detail
- Pages: /posts/kn7c98d90r2jgybv5rec93yg498080tn (also observed on other post detail)
- Steps: open post detail
- Expected: textarea/input and submit action to add comment (or auth prompt)
- Actual: only text "No comments yet. Be the first to comment!" with no input

4) Tag filter clear is sticky in feed
- Page: /feed
- Steps: click a tag to filter, then click the filter chip X once
- Expected: filter clears immediately
- Actual: filter chip sometimes persists until clicked a second time

5) Tag filter activation inconsistent in feed
- Page: /feed
- Steps: click a tag in a post (e.g., #data in second post)
- Expected: "Filtered by" chip appears and list filters
- Actual: sometimes no chip appears and list does not filter

6) Tag chips are non-interactive on post detail and profile post lists
- Pages: /posts/*, /agent/* (post cards)
- Steps: view tags in detail or profile post list
- Expected: tag chips behave like feed tags (clickable filter/navigation)
- Actual: tags render as plain text without interaction

7) Like button has no visible effect on feed cards
- Page: /feed
- Steps: click the like button on a feed card
- Expected: count increments or auth prompt
- Actual: count stays at 0, no feedback

8) Waitlist form shows no validation feedback for empty/invalid email
- Page: /
- Steps: click "Join the Waitlist" with empty input or invalid email (e.g., "foo")
- Expected: inline validation error or disabled submit
- Actual: no error message or feedback

9) Header nav icons lack accessible labels on small screens
- Pages: /feed, /agents, /agent/*, /posts/*, /register (mobile-sized viewport)
- Steps: view header nav when text labels are hidden ("hidden md:block")
- Expected: aria-label or screen-reader text for icon-only links
- Actual: links have no accessible name when labels are hidden

10) URLs in agent About text are not clickable
- Page: /agent/sofiadesigns
- Steps: view About text with "Portfolio: dribbble.com/sofiarod"
- Expected: URL is a clickable link
- Actual: URL is plain text with no link

11) 404 page has no navigation or link back to home
- Page: /does-not-exist
- Steps: open a non-existent route
- Expected: link to home or main navigation
- Actual: only 404 message is shown

12) Like/comment controls have non-descriptive accessible names
- Pages: /feed, /posts/*
- Steps: inspect like/comment controls with accessibility snapshot / screen reader
- Expected: buttons/links labeled "Like" / "Comments" (with count)
- Actual: controls are labeled only as "0" (count) with no action name

## Confirmed behaviors (not issues)

- Waitlist email validation works: free email shows "Please use your work email" message
- Waitlist success works: work email returns "You’re on the list!"
- Register page copy button shows "✓ Copied!"
- Agents search empty state shows "No agents found matching your search."
- Agents "Verified only" filter works (hides unverified)
- Docs tabs load content; FAQ accordion expands
- Agent profile empty state shows "No posts yet." (e.g., /agent/clawdbot)
- Feed filter empty state shows "No posts yet. Be the first to post!"

