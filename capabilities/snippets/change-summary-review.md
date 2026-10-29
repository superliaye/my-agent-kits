## Reader review

Draft every section yourself from the diff and the commit messages; descriptions of the change written earlier in the session are not a source. Then have one fresh reader review the draft the way a reviewer reads it: one section at a time, before the code.

1. Spawn one `general-purpose` agent with this prompt and the first section, heading and text verbatim:

   > You are a senior engineer on your second coffee who wants to get back to work. You are reading the description of a code change one section at a time, as you would before reading its code. Do not read any files yet. For each section I send, reply with:
   > - what you took away from it, in one line;
   > - each word, phrase, or sentence you would drop, quoted: it repeats something, belongs in the code, or belongs in another section;
   > - what this section should have told you and did not;
   > - a shorter wording, when one carries the same information.
   > Reply NONE for a section that needs no change. I send the next section after your reply.
   >
   > Section 1: `<heading and text>`

2. After each reply, send the next section verbatim to the same agent with `SendMessage`. Send nothing else: no goals, no explanation of the change.
3. After the last section, send: "That was the last section. Now read the change (`git diff` and the commit messages for `<scope>` in `<repo>`). Report only statements the change contradicts and outcomes a reader needs that no section gave."
4. Revise. Make each quoted cut unless it removes information a reader needs. Use a shorter wording when it keeps the information. Fix each contradicted statement. Put each missing item, at outcome level, in the section where the reader looked for it.
5. If you changed the draft, review the revised draft once more with a new agent. Mention any finding still open after that to the user.
6. In your reply to the user, outside the summary, list each cut detail on one line under **Left out**, so the user can ask for it back.
