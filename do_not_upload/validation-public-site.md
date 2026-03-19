# Validation Contract — Milestone 3: Public Site

> Draft date: 2026-03-18
> Scope: All public-facing pages and interactions for the 68kb knowledge base port (TypeScript + React + Hono + Bun).

---

## 1. Public Layout (Shell)

### VAL-PUB-001 — Top Navigation Links

**Title:** Main navigation bar renders all expected links

**Behavior:** The top navigation bar displays four links: **Home**, **Categories**, **Glossary**, and **Advanced Search**. Each link navigates to its respective route (`/`, `/categories`, `/glossary`, `/search`).

**Pass criteria:**
- All four links are visible in the nav bar on every public page.
- Clicking each link navigates to the correct route.
- The currently active route's link has a visual "current" indicator (e.g., active class).

**Evidence:**
- Screenshot or DOM snapshot showing all four nav links.
- Navigation test confirming each link resolves to the expected URL.
- Active-state class applied to the link matching the current route.

---

### VAL-PUB-002 — User Navigation (Logged Out)

**Title:** Login and Register links shown when not authenticated

**Behavior:** When no user session exists, the top-right user nav area displays **Login** and **Register** links pointing to `/users/login` and `/users/register` respectively.

**Pass criteria:**
- "Login" and "Register" links are visible.
- No "Welcome" or "My Account" text is shown.
- Links navigate to the correct auth routes.

**Evidence:**
- DOM snapshot with no auth cookie/session showing Login | Register.
- HTTP request confirming unauthenticated state.

---

### VAL-PUB-003 — User Navigation (Logged In)

**Title:** Welcome message and My Account link shown when authenticated

**Behavior:** When a valid user session exists, the top-right user nav area displays **"Welcome, {username}"** (linking to the user's profile) and a **"My Account"** link (to `/users/account`). Login/Register links are hidden.

**Pass criteria:**
- "Welcome, {username}" text is displayed with the correct username.
- "My Account" link is visible and navigates to `/users/account`.
- "Login" and "Register" are not rendered.

**Evidence:**
- DOM snapshot with authenticated session showing welcome text.
- Username matches the logged-in user's stored username.

---

### VAL-PUB-004 — Sidebar Search Box

**Title:** Sidebar contains a functional search input and submit button

**Behavior:** The sidebar displays a search section with a heading ("Search"), a text input for keywords, a submit button, and an "Advanced Search" link. Submitting the form posts keywords to the search endpoint.

**Pass criteria:**
- Search heading, text input, and submit button are visible in the sidebar.
- "Advanced Search" link navigates to `/search`.
- Typing a keyword and clicking submit initiates a search request.

**Evidence:**
- DOM snapshot of sidebar search section.
- Network trace showing form submission with keyword payload.

---

### VAL-PUB-005 — Sidebar Category Listing

**Title:** Sidebar displays category tree with article counts

**Behavior:** The sidebar includes a "Categories" section that renders a hierarchical list of all visible categories. Each category name links to its browse page. Article counts are shown next to each category name (when `show_total="yes"`).

**Pass criteria:**
- All categories with `cat_display = 'yes'` appear in the sidebar list.
- Each category name is a clickable link to `/categories/{cat_uri}`.
- Article count is displayed next to each category.
- Nested sub-categories are rendered hierarchically.

**Evidence:**
- DOM snapshot of sidebar category list.
- Database query confirming displayed categories match `cat_display = 'yes'` records.
- Article counts match `total_articles()` computation for each category.

---

### VAL-PUB-006 — Footer Content

**Title:** Footer shows copyright year and site title

**Behavior:** The page footer displays a copyright notice with the current year and the configured site title.

**Pass criteria:**
- Footer contains `© {current_year} {site_title}`.
- Site title matches the value from the `settings` table (`site_title` key).

**Evidence:**
- DOM snapshot of footer element.
- Comparison of rendered site title to database setting.

---

### VAL-PUB-007 — Layout Renders on All Public Pages

**Title:** Layout shell (nav, sidebar, footer) wraps all public page content

**Behavior:** Every public page (home, article detail, category browse, search, glossary) is rendered inside the layout shell with navigation, sidebar, and footer intact.

**Pass criteria:**
- Navigation bar, sidebar, and footer appear on at least: `/`, `/article/{uri}`, `/categories/{uri}`, `/search`, `/glossary`.

**Evidence:**
- DOM snapshots from five distinct public routes all showing the layout shell.

---

## 2. Homepage

### VAL-HOME-001 — Category Grid Display

**Title:** Homepage displays a 3-column category grid

**Behavior:** The homepage renders a grid of top-level categories (those with `cat_parent = 0`) in a 3-column layout. Each cell shows the category **name**, **description**, and **article count**. Category names link to their browse pages.

**Pass criteria:**
- Only top-level categories (`cat_parent = 0`, `cat_display = 'yes'`) appear.
- Grid renders in 3-column layout.
- Each cell displays name, description, and article count.
- Category names link to `/categories/{cat_uri}`.

**Evidence:**
- DOM snapshot of the category grid.
- Count of rendered categories matches database query for top-level visible categories.
- Article counts match `total_articles()` for each category.

---

### VAL-HOME-002 — Popular Articles List

**Title:** Homepage displays most popular articles sorted by hit count

**Behavior:** A "Most Popular" section renders an ordered list of articles sorted by `article_hits` descending. Each item is a link to the article's detail page.

**Pass criteria:**
- Section heading reads "Most Popular" (or equivalent).
- Articles are listed in descending order of `article_hits`.
- Each article title is a link to `/article/{article_uri}`.
- Only articles with `article_display = 'y'` are shown.

**Evidence:**
- DOM snapshot of the popular articles section.
- Ordering verified against database `ORDER BY article_hits DESC`.

---

### VAL-HOME-003 — Recent Articles List

**Title:** Homepage displays recently published articles sorted by date

**Behavior:** A "Recent Articles" section renders an ordered list of articles sorted by `article_date` descending. Each item is a link to the article's detail page.

**Pass criteria:**
- Section heading reads "Recent Articles" (or equivalent).
- Articles are listed in descending order of `article_date`.
- Each article title is a link to `/article/{article_uri}`.
- Only articles with `article_display = 'y'` are shown.

**Evidence:**
- DOM snapshot of the recent articles section.
- Ordering verified against database `ORDER BY article_date DESC`.

---

### VAL-HOME-004 — Empty State (No Categories)

**Title:** Homepage gracefully handles zero categories

**Behavior:** When no categories exist (or none have `cat_display = 'yes'`), the category grid area either shows an empty state message or renders cleanly without errors.

**Pass criteria:**
- No JavaScript errors or broken layout.
- Page loads successfully with a 200 status code.

**Evidence:**
- DOM snapshot with empty category table.
- Console/error log showing no exceptions.

---

### VAL-HOME-005 — Empty State (No Articles)

**Title:** Homepage gracefully handles zero articles

**Behavior:** When no articles exist, the "Most Popular" and "Recent Articles" sections either show an empty state or render empty lists without errors.

**Pass criteria:**
- No JavaScript errors or broken layout.
- Lists render empty or display a placeholder message.

**Evidence:**
- DOM snapshot showing empty article lists.
- Console/error log clean.

---

## 3. Article Detail

### VAL-ART-001 — Article Title and Content

**Title:** Article detail page renders title and full HTML content

**Behavior:** Navigating to `/article/{article_uri}` displays the article's `article_title` as a heading and `article_description` as the main body content (with HTML rendered).

**Pass criteria:**
- The `<h1>` (or equivalent heading) matches `article_title` from the database.
- The body content matches `article_description` (HTML rendered, not escaped).
- Only articles with `article_display = 'y'` are accessible.

**Evidence:**
- DOM snapshot showing title and content.
- Content compared against database record.

---

### VAL-ART-002 — Article Categories (Links)

**Title:** Article detail shows associated categories as links

**Behavior:** Below the article content, the categories this article belongs to are displayed as comma-separated links. Each link navigates to `/categories/{cat_uri}`.

**Pass criteria:**
- All categories associated via `article2cat` (with `cat_display = 'yes'`) are listed.
- Each category name is a clickable link to its browse page.

**Evidence:**
- DOM snapshot of the categories section.
- Linked category URIs match database `cat_uri` values.

---

### VAL-ART-003 — Last Modified Date

**Title:** Article detail displays the last modified date

**Behavior:** The article info section shows the `article_modified` timestamp formatted as a human-readable date.

**Pass criteria:**
- A "Last Updated" (or equivalent) label is present.
- The displayed date corresponds to the `article_modified` field.

**Evidence:**
- DOM snapshot showing the date.
- Date value matches formatted `article_modified` from the database.

---

### VAL-ART-004 — Hit/View Count Display

**Title:** Article detail displays the current view count

**Behavior:** The article info section shows the number of views (`article_hits`) for the article.

**Pass criteria:**
- A view/hit count is displayed (e.g., "with {N} views").
- The count reflects the value in the `article_hits` column.

**Evidence:**
- DOM snapshot showing the hit count.
- Count compared to the database value (accounting for the current visit's increment).

---

### VAL-ART-005 — Hit Counter Increment

**Title:** Viewing an article increments its hit counter

**Behavior:** Each time an article detail page is loaded, the `article_hits` field in the database is incremented by 1.

**Pass criteria:**
- Record the `article_hits` value before loading the page.
- After loading the page, query the database; the value has increased by exactly 1.
- Subsequent loads each increment by 1.

**Evidence:**
- Database query before and after page load showing `article_hits` increment.
- Multiple page loads show consistent +1 increments.

---

### VAL-ART-006 — File Attachments

**Title:** Article detail lists downloadable file attachments

**Behavior:** If an article has attachments in the `attachments` table, they are rendered as a list of download links inside a fieldset labeled "Attachments." Each link's text is the attachment title (`attach_title`) and its `href` points to the file download path.

**Pass criteria:**
- Attachments fieldset appears only when `get_attachments()` returns data.
- Each attachment is a clickable download link with correct title text.
- Download links resolve to the correct file path (`uploads/{article_id}/{attach_file}`).

**Evidence:**
- DOM snapshot showing attachments list for an article with attachments.
- Clicking a link initiates a file download (or opens in new tab).

---

### VAL-ART-007 — File Attachments (None)

**Title:** Attachments section is hidden when no attachments exist

**Behavior:** If an article has no attachments, the attachments fieldset/section is not rendered at all.

**Pass criteria:**
- No "Attachments" heading, fieldset, or empty list is shown.

**Evidence:**
- DOM snapshot of an article with zero attachments confirming section absence.

---

### VAL-ART-008 — Glossary Tooltips

**Title:** Glossary terms in article content are highlighted with definition tooltips

**Behavior:** When the article description contains text matching glossary terms from the `glossary` table, the first occurrence of each term is wrapped in a tooltip link. The tooltip displays the term name and its definition (truncated to 75 characters). The link points to `/glossary/term/{g_term}`.

**Pass criteria:**
- Matching glossary term in article body is wrapped in an `<a>` tag with class `tooltip`.
- The `title` attribute contains `{term} - {definition (≤75 chars)}`.
- Only the first occurrence of each term is highlighted.
- The link `href` points to the correct glossary term page.

**Evidence:**
- DOM snapshot showing tooltip-wrapped term in article body.
- Title attribute content matches truncated glossary definition.
- Second occurrence of the same term is not wrapped.

---

### VAL-ART-009 — Article Not Found (404)

**Title:** Invalid article URI returns 404

**Behavior:** Navigating to `/article/{nonexistent-uri}` returns a 404 response (or shows a "not found" page).

**Pass criteria:**
- HTTP response status is 404.
- A user-friendly error page or message is displayed.

**Evidence:**
- HTTP response status code = 404.
- DOM snapshot of error page.

---

### VAL-ART-010 — Hidden Article Not Accessible

**Title:** Articles with `article_display != 'y'` are not publicly accessible

**Behavior:** An article whose `article_display` field is not `'y'` cannot be viewed on the public site, even if the URI is known.

**Pass criteria:**
- Navigating to the URI of a hidden article returns 404.
- The article does not appear in homepage lists, search results, or category listings.

**Evidence:**
- HTTP 404 for a known URI of a hidden article.
- Homepage popular/recent lists exclude hidden articles.

---

## 4. Category Browse

### VAL-CAT-001 — Sub-Category Grid

**Title:** Category page displays sub-categories of the current category

**Behavior:** When browsing a category that has child categories, a sub-category grid is displayed. Each sub-category shows its name, description, and article count. Names link to the sub-category's browse page.

**Pass criteria:**
- Only direct children (`cat_parent = current_cat_id`, `cat_display = 'yes'`) are shown.
- Each sub-category cell has name (as link), description, and article count.
- Links navigate to `/categories/{sub_cat_uri}`.

**Evidence:**
- DOM snapshot of sub-category grid.
- Query confirmation of child categories matching displayed results.

---

### VAL-CAT-002 — Category Name and Description

**Title:** Category page displays the current category's name and description

**Behavior:** The category browse page shows the `cat_name` as a heading and `cat_description` as body text.

**Pass criteria:**
- `<h2>` (or equivalent) matches `cat_name` from the database.
- Description text matches `cat_description`.

**Evidence:**
- DOM snapshot showing name and description.
- Values compared against database record.

---

### VAL-CAT-003 — Paginated Article List

**Title:** Category page shows paginated list of articles in this category

**Behavior:** Below the sub-category grid, articles belonging to the current category are listed. The list is paginated (configurable `per_page`). Each article title links to its detail page.

**Pass criteria:**
- Only articles associated with the current category (via `article2cat`) and `article_display = 'y'` are listed.
- Article titles link to `/article/{article_uri}`.
- Pagination controls appear when total articles exceed `per_page`.
- Navigating pagination pages shows the next set of articles.

**Evidence:**
- DOM snapshot of article list with pagination.
- Page 2 shows a different set of articles than page 1.
- Total article count matches database count for this category.

---

### VAL-CAT-004 — Breadcrumb Navigation

**Title:** Category page shows breadcrumb trail from root to current category

**Behavior:** A breadcrumb trail is rendered showing the path from "Categories" (root) through parent categories to the current category. Each breadcrumb segment is a link.

**Pass criteria:**
- Breadcrumb starts with "Categories" linking to `/categories`.
- Each ancestor category is listed in order from root to current.
- The current category is the last breadcrumb item.
- All breadcrumb links navigate to the correct category URI.

**Evidence:**
- DOM snapshot of breadcrumb for a deeply nested category (≥2 levels).
- Each breadcrumb link's `href` matches the ancestor's `cat_uri`.

---

### VAL-CAT-005 — Empty Category (No Articles)

**Title:** Category page displays "no articles" message when category has no articles

**Behavior:** When a category has zero articles associated with it, a message like "No articles found" is displayed instead of an article list.

**Pass criteria:**
- The "no articles" message is displayed.
- No empty `<ul>` or broken pagination is rendered.

**Evidence:**
- DOM snapshot of an empty category showing the message.

---

### VAL-CAT-006 — Empty Category (No Sub-Categories)

**Title:** Category page gracefully handles zero sub-categories

**Behavior:** When a category has no child categories, the sub-category grid section is either hidden or renders cleanly without errors.

**Pass criteria:**
- No broken sub-category grid or JavaScript errors.
- Page loads with 200 status.

**Evidence:**
- DOM snapshot of a leaf category with no sub-categories.

---

### VAL-CAT-007 — Invalid Category URI Redirect

**Title:** Invalid category URI redirects to categories index

**Behavior:** Navigating to `/categories/{nonexistent-uri}` redirects the user to `/categories` (the root categories page).

**Pass criteria:**
- HTTP response is a 302 redirect to `/categories`.
- No 500 error or broken page.

**Evidence:**
- HTTP response headers showing redirect to `/categories`.

---

### VAL-CAT-008 — Categories Index (Root Level)

**Title:** `/categories` without a URI shows all top-level categories

**Behavior:** Navigating to `/categories` (no specific category URI) displays the root-level category listing with a "Categories" heading.

**Pass criteria:**
- Heading reads "Categories" (or localized equivalent).
- All top-level categories (`cat_parent = 0`, `cat_display = 'yes'`) are listed.

**Evidence:**
- DOM snapshot of the categories index page.

---

## 5. Search

### VAL-SEARCH-001 — Advanced Search Form

**Title:** Advanced search page renders keyword input and category dropdown

**Behavior:** The `/search` page displays a form with a "Keywords" text input and a "Category" dropdown select populated with all visible categories (hierarchically). A submit button triggers the search.

**Pass criteria:**
- Keywords text input is present and accepts text.
- Category dropdown is populated with all visible categories from the database.
- Submit button is visible and functional.
- Breadcrumb shows "Search" segment.

**Evidence:**
- DOM snapshot of the search form.
- Dropdown options compared against `get_categories()` result.

---

### VAL-SEARCH-002 — Search by Keywords

**Title:** Searching by keywords returns matching articles

**Behavior:** Submitting the search form with keywords performs a search against `article_title`, `article_short_desc`, and `article_description`. The user is redirected to a results page showing matching articles.

**Pass criteria:**
- Search with a keyword that exists in an article's title returns that article.
- Search with a keyword in an article's description returns that article.
- Each result links to the correct article detail page.
- Only articles with `article_display = 'y'` appear in results.

**Evidence:**
- Search for a known keyword; result list includes the expected article.
- Result link `href` matches `/article/{article_uri}`.

---

### VAL-SEARCH-003 — Search by Category Filter

**Title:** Searching with a category filter restricts results to that category

**Behavior:** When a category is selected in the search form along with keywords, results are limited to articles within the selected category and its child categories.

**Pass criteria:**
- Results only include articles belonging to the selected category or its descendants.
- An article in a different category (matching keywords) is excluded.

**Evidence:**
- Search with category filter; results verified against `article2cat` relationships.
- Cross-category article not in results.

---

### VAL-SEARCH-004 — Search Results Pagination

**Title:** Search results are paginated

**Behavior:** When the number of matching articles exceeds the configured `site_max_search` per-page limit, pagination controls appear. Navigating pages shows subsequent result sets.

**Pass criteria:**
- Pagination links appear when result count > `per_page`.
- Page 2 shows different results than page 1.
- All results across pages account for the total match count.

**Evidence:**
- DOM snapshot of paginated search results.
- Total results across pages matches `search_total`.

---

### VAL-SEARCH-005 — No Results Message

**Title:** Search with no matches shows "no results" message

**Behavior:** When a search returns zero results, the user is redirected to a "no results" page that displays a message (e.g., "No results found") and a link to search again.

**Pass criteria:**
- The "no results" message is displayed.
- A "Search again" link is provided, navigating back to the search form (or using browser history).

**Evidence:**
- Search for a nonsensical string; "no results" page is rendered.
- "Search again" link is functional.

---

### VAL-SEARCH-006 — Search Logging

**Title:** Search terms are stored in the searchlog table

**Behavior:** Every successful search (one that produces results) logs the search keyword(s) to the `searchlog` table with the date, user ID (if logged in), term, and IP address.

**Pass criteria:**
- After a search, a new row exists in `searchlog` with matching `searchlog_term`.
- `searchlog_date` is approximately the current time.
- `searchlog_ip` matches the client's IP.
- `searchlog_user_id` matches the session user (or null/0 for anonymous).

**Evidence:**
- Database query of `searchlog` table after performing a search.
- Row contents match the search parameters.

---

### VAL-SEARCH-007 — Search with Empty Keywords

**Title:** Submitting search with no keywords redirects to no-results

**Behavior:** If the search form is submitted with no keywords and no category, the user is redirected to the "no results" page.

**Pass criteria:**
- No server error or crash.
- User sees the "no results" message or is redirected to the search form.

**Evidence:**
- HTTP response is a redirect to `/search/no_results` or the search page.

---

### VAL-SEARCH-008 — Search Hash Expiration

**Title:** Old search result hashes are cleaned up

**Behavior:** Search results are stored with a hash and timestamp. Results older than 1 hour are deleted by `clean_search_results()` on subsequent result page loads.

**Pass criteria:**
- A search hash created > 1 hour ago is no longer accessible.
- Accessing an expired hash redirects to "no results."

**Evidence:**
- Create a search, wait (or simulate time passage), then access the hash URL; redirected to "no results."

---

### VAL-SEARCH-009 — Malformed Search Hash

**Title:** Invalid search hash redirects to no-results

**Behavior:** Navigating to `/search/results/{invalid-hash}` (where the hash is not exactly 32 characters or does not exist) redirects to the "no results" page.

**Pass criteria:**
- Hash shorter/longer than 32 chars → redirect to "no results."
- Valid-length but nonexistent hash → redirect to "no results."

**Evidence:**
- HTTP redirect response for invalid hash URL.

---

## 6. Glossary

### VAL-GLOSS-001 — A–Z Navigation Bar

**Title:** Glossary page displays an A–Z letter navigation bar

**Behavior:** The `/glossary` page renders a row of links for each letter A through Z, plus a `#` link for symbols/numbers. Each letter links to `/glossary/term/{letter}`.

**Pass criteria:**
- All 26 letters (a–z) are displayed as links.
- A `#` link for symbols/numbers is displayed, linking to `/glossary/term/sym`.
- Each letter link navigates to the correct filtered view.

**Evidence:**
- DOM snapshot of the A–Z bar.
- Letter link `href` values match `/glossary/term/{letter}`.

---

### VAL-GLOSS-002 — Full Glossary List

**Title:** Glossary page displays all terms and definitions alphabetically

**Behavior:** The glossary page lists all entries from the `glossary` table, ordered by `g_term` ascending. Each entry shows the term (as a named anchor) and its definition.

**Pass criteria:**
- All glossary records are displayed.
- Terms are in alphabetical order.
- Each term has a named anchor (`<a name="{g_term}">`).
- Definitions are rendered as HTML content.

**Evidence:**
- DOM snapshot of glossary list.
- Term count matches `SELECT COUNT(*) FROM glossary`.
- Ordering matches `ORDER BY g_term ASC`.

---

### VAL-GLOSS-003 — Letter Filtering

**Title:** Clicking a letter filters glossary to terms starting with that letter

**Behavior:** Navigating to `/glossary/term/{letter}` shows only glossary terms whose `g_term` starts with the given letter.

**Pass criteria:**
- Only terms starting with the selected letter are displayed.
- The A–Z bar remains visible for further filtering.
- Terms are still in alphabetical order.

**Evidence:**
- Navigate to `/glossary/term/a`; all displayed terms start with "A" (case-insensitive).
- Database query `WHERE g_term LIKE 'a%'` matches displayed results.

---

### VAL-GLOSS-004 — Symbol/Number Filtering

**Title:** The `#` link filters glossary to terms starting with numbers or symbols

**Behavior:** Navigating to `/glossary/term/sym` shows glossary terms starting with digits (0–9) or symbols (`.`).

**Pass criteria:**
- Only terms starting with 0–9 or `.` are displayed.
- The A–Z bar remains visible.

**Evidence:**
- Navigate to `/glossary/term/sym`; displayed terms start with digits or symbols.
- Database query matches the multi-`OR` condition from the original code.

---

### VAL-GLOSS-005 — Empty Letter Result

**Title:** Filtering by a letter with no matching terms shows empty list gracefully

**Behavior:** If no glossary terms start with the selected letter, the page renders without errors and shows no definition entries (or an appropriate empty-state message).

**Pass criteria:**
- No JavaScript errors or broken layout.
- The A–Z bar remains functional for selecting other letters.
- Page loads with 200 status.

**Evidence:**
- Navigate to `/glossary/term/x` (assuming no terms start with X); page renders cleanly.

---

### VAL-GLOSS-006 — Glossary Page Title

**Title:** Glossary page sets the correct page title

**Behavior:** The glossary page sets the HTML `<title>` to include "Glossary" (or the localized equivalent from language files).

**Pass criteria:**
- Document title includes the glossary heading text.

**Evidence:**
- HTML `<title>` tag content includes "Glossary."

---

## 7. Glossary Admin CRUD

### VAL-GLOSS-ADMIN-001 — Glossary Grid View

**Title:** Admin glossary page shows a data grid of all terms

**Behavior:** The admin glossary index (`/admin/kb/glossary`) renders a data table with columns for **Term**, **Definition** (truncated), and a **Checkbox** for bulk selection. The grid supports server-side pagination, sorting, and searching.

**Pass criteria:**
- Grid displays all glossary records.
- Term column shows clickable links to the edit page.
- Definition column shows truncated text (≤50 chars).
- Checkbox column is present for each row.
- "Add Term" button is visible and links to `/admin/kb/glossary/add`.

**Evidence:**
- DOM snapshot of the glossary data grid.
- Row count matches total glossary records (accounting for pagination).

---

### VAL-GLOSS-ADMIN-002 — Add Glossary Term

**Title:** Admin can add a new glossary term

**Behavior:** Navigating to `/admin/kb/glossary/add` shows a form with "Term" and "Definition" fields. Submitting a valid form inserts a new record into the `glossary` table and redirects to the glossary grid with a success message.

**Pass criteria:**
- Form has `g_term` and `g_definition` inputs.
- Both fields are required; submitting empty shows validation errors.
- Successful submission creates a new row in `glossary`.
- User is redirected to `/admin/kb/glossary/` with flash message.

**Evidence:**
- Submit the form; new record exists in `glossary` table.
- Redirect response to glossary grid.
- Validation error displayed when fields are empty.

---

### VAL-GLOSS-ADMIN-003 — Edit Glossary Term

**Title:** Admin can edit an existing glossary term

**Behavior:** Navigating to `/admin/kb/glossary/edit/{id}` pre-populates the form with the existing term and definition. Submitting updates the record in the database.

**Pass criteria:**
- Form fields are pre-filled with existing `g_term` and `g_definition`.
- After submission, the database record is updated.
- User is redirected to the glossary grid with a success message.

**Evidence:**
- Form field values match database record before edit.
- After submission, database record reflects new values.

---

### VAL-GLOSS-ADMIN-004 — Bulk Delete Glossary Terms

**Title:** Admin can bulk-delete selected glossary terms

**Behavior:** From the glossary grid, selecting one or more checkboxes and choosing "Delete" from the status dropdown, then clicking "Update," deletes the selected terms from the `glossary` table.

**Pass criteria:**
- Selected term IDs are sent in the POST payload.
- After submission, the selected records no longer exist in `glossary`.
- User is redirected to the glossary grid with a success message.
- Unselected terms remain in the database.

**Evidence:**
- Database record count decreases by the number of selected terms.
- Remaining terms are unaffected.

---

### VAL-GLOSS-ADMIN-005 — Edit Non-Existent Term

**Title:** Editing a non-existent glossary ID redirects gracefully

**Behavior:** Navigating to `/admin/kb/glossary/edit/{invalid-id}` (non-numeric or non-existent ID) redirects to the glossary grid without errors.

**Pass criteria:**
- No 500 error or stack trace.
- User is redirected to `/admin/kb/glossary/`.

**Evidence:**
- HTTP redirect response for invalid ID.

---

## 8. Cross-Cutting Concerns

### VAL-XCUT-001 — XSS Protection on User Input

**Title:** User-supplied input is sanitized against XSS

**Behavior:** All user-supplied values (search keywords, URLs, form inputs) are sanitized/escaped before rendering in HTML output.

**Pass criteria:**
- Searching for `<script>alert('xss')</script>` does not execute JavaScript.
- Article URIs containing special characters are properly escaped.

**Evidence:**
- Search with XSS payload; page source shows escaped HTML entities.

---

### VAL-XCUT-002 — Hidden Categories Not Displayed

**Title:** Categories with `cat_display != 'yes'` are excluded from all public views

**Behavior:** Categories marked as hidden do not appear in the sidebar, homepage grid, category browse, search category dropdown, or breadcrumbs.

**Pass criteria:**
- A category with `cat_display = 'no'` is absent from all public-facing category lists.

**Evidence:**
- Database has a hidden category; it does not appear on any public page.

---

### VAL-XCUT-003 — Responsive/Accessible Layout

**Title:** Public pages maintain usable layout across viewport sizes

**Behavior:** The layout (nav, sidebar, content, footer) renders without horizontal overflow or overlapping elements at common viewport widths (320px, 768px, 1024px, 1440px).

**Pass criteria:**
- No horizontal scrollbar at any tested width.
- Navigation remains accessible (hamburger menu or equivalent on mobile).
- Content is readable at all sizes.

**Evidence:**
- Screenshots at 4 viewport widths showing correct layout.

---

### VAL-XCUT-004 — Page Meta Tags

**Title:** Article pages set meta keywords and description

**Behavior:** When viewing an article, the HTML `<meta name="keywords">` and `<meta name="description">` tags are populated from `article_keywords` and `article_short_desc` respectively.

**Pass criteria:**
- Meta keywords tag content matches `article_keywords`.
- Meta description tag content matches `article_short_desc`.

**Evidence:**
- HTML source of article page showing populated meta tags.
