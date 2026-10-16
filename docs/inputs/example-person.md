# Input: the made-up person (for `data/example.js`)

Used by "Try with a made-up person" and by workshop copies (PLAN T2.6). Everything here is invented. The organisation
names below are fictional. If one turns out to match a real Toronto business, rename it; do not use real employers.

## Profile

| Field | Value |
|---|---|
| `roles` | Office administration, bookkeeping, accounts payable |
| `field` | Finance and office work |
| `background` | Six years as an accounts-payable clerk in her home country. Moved to Toronto 14 months ago. |
| `area` | Scarborough; travels by TTC |
| `languages` | English (good, but she is nervous speaking to strangers), and her first language (left unnamed on purpose) |
| `replyLanguage` | English |
| `availability` | Evenings and weekends |
| `avoid` | Anything that costs money to attend |

The display name is "Amira (made up)". The profile itself has no name field (DESIGN 6), so the name lives only in
the example's label.

Context the trials used (not stored, but useful for writing the jobs): she has very little spare money, and she
knows no one in her field here yet.

## Jobs (dates relative to the moment the example loads)

| # | Title | Organisation (fictional) | Stage | Dates | Next step / notes |
|---|---|---|---|---|---|
| 1 | Accounts Payable Clerk | Birchmount Supply Co. | applied | applied −9 days; follow-up **today** | "Email to ask if they got my application" |
| 2 | Office Administrator | Kingsway Dental Group | interview | interview in **+2 days**, 10:00 | "Practise: tell me about yourself" |
| 3 | Bookkeeper (part-time) | Fenwick & Rao Accounting | saved | closes in **+4 days** | "Ask library coach to check resume first" |
| 4 | Administrative Assistant | Lakeview Community Housing | applied | applied −16 days; follow-up **−2 days** (overdue) | none |
| 5 | Data Entry Clerk | Northgate Logistics | closed | applied −30 days | "No reply. Job reposted." |
| 6 | Receptionist / Bookkeeping Support | Danforth Physio Clinic | interview | interview −10 days (so a reply-clock date shows) | "Waiting to hear back" |

Job 2 carries a short made-up posting (about 120 words) and `asks` ("QuickBooks or similar; scheduling; customer
service"), so the coach recipe has something to work with.

## Events

Star two events from the snapshot's library tier: the first resume session and the first interview session in the
snapshot window. Pick them at load time by keyword (`resume`, `interview`), not by fixed id, because the snapshot
changes.
