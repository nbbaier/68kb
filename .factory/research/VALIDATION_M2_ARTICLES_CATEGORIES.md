# Validation Contract — Milestone 2: Articles & Categories

> **Scope**: Admin CRUD for articles, categories, tags, and file attachments  
> **Source of truth**: Original PHP codebase (`68kb` modules: `kb`, `categories`)

---

## 1. Articles — Admin Grid

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-ART-001 | Article grid loads with server-side data | Navigate to admin articles index. The grid fetches articles from the server and renders rows with columns: Title, Categories, Date Added, Date Edited, Display status, and a bulk-select checkbox. | **Pass**: Table renders with correct column headers and at least one row when articles exist; shows empty-state message when none exist. **Fail**: Table fails to load, shows spinner indefinitely, or columns are missing/misordered. | Screenshot of grid with data; screenshot of empty state. |
| VAL-ART-002 | Article grid search filters results | Type a search term into the grid's search input that matches an existing article title. | **Pass**: Grid rows update to show only articles whose title, short description, full description, or URI contain the search term; total count updates. **Fail**: Search does not filter, returns unrelated results, or causes an error. | Screenshot before and after search; network response payload showing filtered results. |
| VAL-ART-003 | Article grid sorting by column | Click a sortable column header (Title, Date Added, Date Edited, Display). | **Pass**: Rows re-order according to the clicked column in ascending order; clicking again toggles to descending. **Fail**: Sort indicator does not appear, rows do not reorder, or sort direction is wrong. | Screenshots showing ascending and descending sort on at least one column. |
| VAL-ART-004 | Article grid pagination | With >10 articles in the database, navigate through pagination controls. | **Pass**: Page controls (next, previous, page numbers) appear; clicking them loads the correct slice of data; row count per page matches the configured page size. **Fail**: All rows shown on one page, pagination controls missing, or wrong rows displayed after navigation. | Screenshots of page 1 and page 2 with distinct data. |
| VAL-ART-005 | Article grid displays category names per article | Each article row in the grid shows its assigned category names as links/labels. | **Pass**: Articles with categories show comma-separated category names; articles with no categories show an empty cell. **Fail**: Categories column is always empty or shows IDs instead of names. | Screenshot of grid rows with visible category names. |
| VAL-ART-006 | Article grid displays active/inactive status | The Display column renders a visual indicator (badge/text) of active (y) vs not-active (n). | **Pass**: Articles with `display = y` show "Active" or equivalent; articles with `display = n` show "Not Active" or equivalent. **Fail**: Status is missing or does not reflect the article's display setting. | Screenshot showing both active and inactive articles. |

---

## 2. Articles — Create (Add)

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-ART-010 | Add article with all fields | Fill in every field: title, URI slug, short description (WYSIWYG), full description (WYSIWYG), display=Yes, meta keywords, weight/order, select multiple categories, attach a file with title. Submit. | **Pass**: Article is created in the database with all fields persisted correctly; user is redirected to the grid or edit page; flash success message appears; file attachment is stored and linked to the article; article2cat junction rows exist for each selected category. **Fail**: Any field value is lost, attachment is missing, categories are not associated, or an error is displayed. | Database record inspection; redirect URL; flash message screenshot; attachment file on disk. |
| VAL-ART-011 | Add article with minimum required fields | Submit the add form with only the title filled in (all other fields left blank/default). | **Pass**: Article is created successfully; URI slug is auto-generated from the title; default display value is applied; no errors. **Fail**: Form rejects submission, or slug is empty, or a server error occurs. | Database record showing auto-generated `article_uri`; success redirect. |
| VAL-ART-012 | Add article validation — missing title | Submit the add form with the title field empty. | **Pass**: Form submission is rejected; the form redisplays with a validation error message indicating the title is required; no database record is created. **Fail**: Article is created without a title, or no error message is shown, or a server error occurs. | Screenshot of form showing validation error for title field. |
| VAL-ART-013 | Add article — URI slug accepts only alpha-dash characters | Enter a URI slug with spaces or special characters (e.g., "my article!"). | **Pass**: Validation rejects the value and displays an error that the URI field must contain only alpha-numeric characters, dashes, and underscores. **Fail**: Invalid URI slug is accepted and stored. | Screenshot of validation error; database record inspection. |
| VAL-ART-014 | Add article — weight/order must be numeric | Enter a non-numeric value in the weight/order field (e.g., "abc"). | **Pass**: Validation rejects the value and displays an error that the weight field must be numeric. **Fail**: Non-numeric weight is accepted. | Screenshot of validation error. |
| VAL-ART-015 | Add article — auto-generates URI from title when URI is blank | Leave the URI field empty and provide a title. Submit the form. | **Pass**: The article's `article_uri` is a slugified version of the title (lowercase, dashes for spaces, no special chars). **Fail**: URI is empty or not derived from the title. | Database record showing `article_uri` value. |
| VAL-ART-016 | Add article — WYSIWYG editors render for short and full description | Navigate to the add article form. | **Pass**: Both the short description and full description fields render as rich-text WYSIWYG editors (Summernote or equivalent) with toolbar buttons (bold, italic, underline, lists, links, code). **Fail**: Plain textareas are shown without rich-text controls. | Screenshot of form with WYSIWYG editors visible. |
| VAL-ART-017 | Add article — category checkboxes multi-select | The category section displays a tree of checkboxes. Select two or more categories. Submit. | **Pass**: All selected categories are stored in the article-to-category junction table; the article appears in each selected category's listing. **Fail**: Only one category is saved, or none are saved, or the checkbox tree does not render. | Database junction table rows; grid showing the article's categories. |
| VAL-ART-018 | Add article — "Save" button redirects to edit page | Submit the form using the "Save" button (as opposed to the default submit). | **Pass**: User is redirected to the edit page for the newly created article, with the form pre-populated. **Fail**: User is redirected elsewhere, or the form is empty. | URL inspection showing `/edit/{id}` path; screenshot of pre-populated form. |
| VAL-ART-019 | Add article — sets timestamps on creation | Create a new article. | **Pass**: Both `article_date` and `article_modified` are set to the current timestamp at creation time. **Fail**: Either timestamp is null, zero, or incorrect. | Database record showing both timestamps. |
| VAL-ART-020 | Add article — records the current user as author | Create a new article while logged in. | **Pass**: The `article_author` field is set to the currently authenticated user's ID. **Fail**: Author is null, zero, or a different user. | Database record showing `article_author`. |

---

## 3. Articles — Edit

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-ART-030 | Edit article form pre-populates all fields | Navigate to edit an existing article. | **Pass**: All fields (title, URI, short desc, full desc, display, keywords, weight, categories, author) are pre-populated with the current database values; WYSIWYG editors contain existing HTML content; category checkboxes reflect current associations. **Fail**: Any field is empty when it should have a value, or wrong values are shown. | Screenshot of the pre-populated edit form. |
| VAL-ART-031 | Edit article — update title and save | Change the title of an existing article and submit. | **Pass**: The article's title is updated in the database; `article_modified` timestamp is updated; flash success message appears; user is redirected correctly. **Fail**: Title is not updated, old title remains, or modified timestamp is unchanged. | Database record before and after; redirect confirmation. |
| VAL-ART-032 | Edit article — change category assignments | Remove an existing category and add a new one. Submit. | **Pass**: The article2cat junction table is updated: the old category association is removed and the new one is added. **Fail**: Old category persists or new category is not added. | Junction table records before and after edit. |
| VAL-ART-033 | Edit article — validation applies same rules | Submit the edit form with the title cleared. | **Pass**: Validation error is shown for the required title field; article is not modified. **Fail**: Article is saved with an empty title. | Screenshot of validation error on edit form. |
| VAL-ART-034 | Edit article — author search (AJAX) | In the edit form, type a username in the author field. | **Pass**: An AJAX request is made; matching usernames appear in a dropdown/display area; selecting one updates the author field. **Fail**: No AJAX request fires, no results appear, or the author is not updated on save. | Network tab showing AJAX request; screenshot of search results. |
| VAL-ART-035 | Edit article — URI can be changed | Change the URI slug on an existing article to a new valid value and save. | **Pass**: The article's `article_uri` is updated to the new value in the database. **Fail**: URI remains unchanged or reverts to the old value. | Database record showing updated URI. |

---

## 4. Articles — Delete

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-ART-040 | Delete article removes record and associations | Delete an article that has categories, tags, and attachments. | **Pass**: The article row is removed from the `articles` table; related rows in `article2cat`, `article_tags`, and `attachments` are deleted; uploaded attachment files are removed from disk. **Fail**: Article persists, orphaned junction rows remain, or attachment files are left on disk. | Database query showing no matching records; file system check. |
| VAL-ART-041 | Delete article — non-existent or invalid ID | Attempt to delete an article with a non-numeric or non-existent ID. | **Pass**: Request is rejected or returns a 404/redirect; no database modification occurs. **Fail**: An unrelated record is deleted, or a server error occurs. | Response status code; database integrity check. |

---

## 5. Articles — File Attachments

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-ART-050 | Upload file attachment on article add | On the add article form, provide an attachment title and select a file. Submit. | **Pass**: File is uploaded to `uploads/{article_id}/` directory; an `attachments` row is created with `article_id`, `attach_title`, `attach_file`, `attach_type`, and `attach_size` fields populated. **Fail**: File is not uploaded, attachment record is missing, or metadata is incorrect. | File on disk; database `attachments` record. |
| VAL-ART-051 | Upload file attachment on article edit | On the edit article form, upload a new file attachment. | **Pass**: File is uploaded; new attachment row is created; the edit form re-renders showing the new attachment in the attachments table. **Fail**: Upload fails silently, or attachment table does not update. | Attachment table in edit form; file on disk. |
| VAL-ART-052 | Attachment list displays all fields | On the edit form, view the attachments table for an article with attachments. | **Pass**: Table shows columns: Title, File, Type, Size, Delete; each row has correct data. **Fail**: Any column is missing or data is incorrect. | Screenshot of attachments table. |
| VAL-ART-053 | Delete individual attachment | Click the delete link for a specific attachment on the edit form. | **Pass**: The attachment row is removed from the database; the physical file is deleted from disk; user is redirected back to the edit form's attachments section. **Fail**: File remains on disk, database row persists, or redirect fails. | Database check; file system check; redirect URL. |
| VAL-ART-054 | Upload with invalid file type | Attempt to upload a file with a type not in the allowed types configuration. | **Pass**: Upload is rejected with an error message; no file is stored; no attachment record is created. **Fail**: Disallowed file type is accepted. | Error message screenshot; file system check. |
| VAL-ART-055 | Upload with no file selected | Submit the article form with the attachment title filled but no file selected. | **Pass**: Article is saved normally; no attachment record is created; no error is thrown. **Fail**: An error occurs or a blank attachment record is created. | Database check. |

---

## 6. Categories — Admin Grid

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-CAT-001 | Category grid loads and displays tree | Navigate to the admin categories index. | **Pass**: A table renders with columns: Title, Allow Ads, Display, Duplicate, Delete. All categories (including hidden) are listed. Child categories are indented with `»` markers reflecting their depth. **Fail**: Table is empty when categories exist, columns are wrong, or indentation is missing. | Screenshot of category grid with parent and child entries. |
| VAL-CAT-002 | Category grid indentation reflects hierarchy | Create a category tree: Root → Child → Grandchild. View the grid. | **Pass**: Root has no indent; Child has one level of indent (one `»`); Grandchild has two levels (two `»` markers). **Fail**: All categories are at the same level, or indentation is wrong. | Screenshot showing three levels of indentation. |
| VAL-CAT-003 | Category grid shows Allow Ads status | Categories with `cat_allowads = yes` display "Yes"; those with `no` display "No". | **Pass**: The Allow Ads column correctly reflects each category's setting. **Fail**: Values are swapped, missing, or always the same. | Screenshot of grid with mixed Allow Ads values. |
| VAL-CAT-004 | Category grid shows Display status | Categories with `cat_display = yes` display "Yes"; those with `no` display "No". | **Pass**: The Display column correctly reflects each category's setting. **Fail**: Values are incorrect. | Screenshot. |
| VAL-CAT-005 | Category grid has Duplicate action link | Each category row has a "Duplicate" link/button. | **Pass**: Clicking Duplicate navigates to the duplicate route for that category. **Fail**: Link is missing or broken. | Screenshot; URL inspection. |
| VAL-CAT-006 | Category grid has Delete action link | Each category row has a "Delete" link/button. | **Pass**: Clicking Delete navigates to the delete route for that category. **Fail**: Link is missing or broken. | Screenshot; URL inspection. |
| VAL-CAT-007 | Category grid empty state | View the grid when no categories exist. | **Pass**: A "no records" message is displayed instead of table rows. **Fail**: An error is shown or the table has broken markup. | Screenshot of empty state. |

---

## 7. Categories — Create (Add)

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-CAT-010 | Add root category with all fields | Fill in: name, URI, description, display=Yes, allow ads=Yes, parent=None, keywords, order, upload an image. Submit. | **Pass**: Category is created; all fields are persisted; image file is uploaded to the configured `cat_image_path`; `cat_image` stores the filename; `cat_uri` is set correctly; user is redirected to the categories grid with success message. **Fail**: Any field is missing/wrong, image not uploaded, or redirect/message fails. | Database record; image file on disk; redirect confirmation. |
| VAL-CAT-011 | Add sub-category (child of existing category) | Create a category with `cat_parent` set to an existing category. | **Pass**: The new category's `cat_parent` references the parent's ID; `cat_uri` is built as `parent-slug/child-slug` (hierarchical); the category appears indented under its parent in the grid. **Fail**: Parent relationship not set, URI is flat (no parent prefix), or grid shows wrong nesting. | Database record with `cat_parent`; `cat_uri` value; grid screenshot. |
| VAL-CAT-012 | Add category — name required validation | Submit the add form with the name field empty. | **Pass**: Form redisplays with a validation error for the required name field; no record is created. **Fail**: Category is created without a name, or no error message appears. | Screenshot of validation error. |
| VAL-CAT-013 | Add category — URI alpha-dash validation | Enter a URI with spaces or special characters. | **Pass**: Validation rejects the value with an appropriate error message. **Fail**: Invalid URI is accepted. | Screenshot of validation error. |
| VAL-CAT-014 | Add category — auto-generates URI from name when URI is blank | Leave URI empty; provide a name. Submit. | **Pass**: `cat_uri` is a slugified version of the name. **Fail**: URI is empty or not derived from name. | Database record. |
| VAL-CAT-015 | Add category — URI uniqueness | Create two categories with the same name and no explicit URI. | **Pass**: The second category gets a unique URI (e.g., appended with `_1`). Both categories exist with distinct URIs. **Fail**: Duplicate URI is stored, causing conflicts. | Database records showing distinct `cat_uri` values. |
| VAL-CAT-016 | Add category — order defaults to 0 when blank | Leave the order field empty. Submit. | **Pass**: Category is created with `cat_order = 0`. **Fail**: Order is null or causes an error. | Database record. |
| VAL-CAT-017 | Add category — image upload constraints | Upload an image exceeding the max size (100KB) or invalid type (e.g., .bmp). | **Pass**: Upload is rejected with an appropriate error message; no image file is stored. **Fail**: Oversized or invalid-type image is accepted. | Error message; file system check. |
| VAL-CAT-018 | Add category — parent dropdown shows all categories with hierarchy | Open the add form. Inspect the parent dropdown. | **Pass**: Dropdown includes "No Parent" as the first option, followed by all existing categories with hierarchical indentation (`»` markers for children). **Fail**: Dropdown is empty, flat (no indentation), or missing categories. | Screenshot of parent dropdown. |

---

## 8. Categories — Edit

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-CAT-020 | Edit category form pre-populates all fields | Navigate to edit an existing category. | **Pass**: Name, URI (last segment only, without parent path), description, display, allow ads, parent, keywords, order are all pre-populated. If an image exists, it is displayed with a delete link. **Fail**: Any field is blank when it should have data, or wrong data is shown. | Screenshot of pre-populated edit form. |
| VAL-CAT-021 | Edit category — update name and save | Change the name, submit. | **Pass**: Name is updated in the database; success message and redirect to grid. **Fail**: Name is unchanged. | Database record; redirect. |
| VAL-CAT-022 | Edit category — change parent | Move a root category to become a child of another category. | **Pass**: `cat_parent` is updated; `cat_uri` is rebuilt to include the new parent's path. **Fail**: Parent is not updated or URI path is incorrect. | Database record showing updated `cat_parent` and `cat_uri`. |
| VAL-CAT-023 | Edit category — upload new image replaces old | Edit a category that already has an image. Upload a new image. | **Pass**: The old image file is deleted from disk; the new image is stored; `cat_image` in the database is updated to the new filename. **Fail**: Old image persists on disk, or `cat_image` still references the old filename. | File system check (old file gone, new file present); database record. |
| VAL-CAT-024 | Edit category — delete existing image | Click the delete image link on a category that has an image. | **Pass**: Image file is removed from disk; `cat_image` is set to empty string in the database; user is redirected back to the edit form. **Fail**: File persists, database still has the image name, or redirect fails. | File system check; database record; redirect URL. |
| VAL-CAT-025 | Edit category — validation applies same rules | Submit the edit form with the name cleared. | **Pass**: Validation error for required name; category is not modified. **Fail**: Category is saved without a name. | Validation error screenshot. |
| VAL-CAT-026 | Edit category — order is required and must be integer | Submit with a non-integer order value. | **Pass**: Validation error for order field. **Fail**: Non-integer order is accepted. | Validation error screenshot. |
| VAL-CAT-027 | Edit category — display of existing image | Open the edit form for a category that has an image. | **Pass**: The current image is rendered visually (e.g., `<img>` tag) and a delete link is visible next to it. **Fail**: No image preview or no delete link. | Screenshot of image preview + delete link. |
| VAL-CAT-028 | Edit category — no image section when image is empty | Open the edit form for a category that has no image. | **Pass**: The image preview section is not shown; only the upload input is visible. **Fail**: A broken image placeholder or delete link for a non-existent image is shown. | Screenshot of form without image preview. |

---

## 9. Categories — Duplicate

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-CAT-030 | Duplicate category pre-fills add form | Click "Duplicate" on a category from the grid. | **Pass**: The add category form is displayed (action=add) with all fields pre-populated from the source category's data (name, URI segment, description, display, allow ads, parent, keywords, order). The heading indicates "Duplicate". **Fail**: Form is empty, or values don't match the source category. | Screenshot of pre-filled form; comparison with source category data. |
| VAL-CAT-031 | Duplicate category — submitting creates a new record | After duplicating, submit the form. | **Pass**: A new category is created (new `cat_id`); the original category is unchanged; both exist in the grid. **Fail**: The original is modified instead of creating a new record. | Database showing both old and new category records. |
| VAL-CAT-032 | Duplicate category — invalid ID | Navigate to the duplicate route with a non-numeric ID. | **Pass**: Redirected to the categories grid with an error flash message. **Fail**: Server error or unexpected behavior. | Redirect URL; flash message. |

---

## 10. Categories — Delete

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-CAT-040 | Delete category with no articles | Delete a category that has zero articles associated. | **Pass**: Category is immediately deleted; image file (if any) is removed; category-product junction records are cleaned up; success message and redirect to grid. **Fail**: Category persists, or orphaned data remains. | Database check; file system check; redirect. |
| VAL-CAT-041 | Delete category with articles — reassignment prompt | Attempt to delete a category that has articles. | **Pass**: A confirmation form is displayed showing the number of articles that will be affected and a dropdown to select a replacement category. The dropdown shows all categories with hierarchy indentation. **Fail**: Category is deleted without warning, or the reassignment form does not appear. | Screenshot of reassignment form showing article count and dropdown. |
| VAL-CAT-042 | Delete category with articles — reassignment executes | On the reassignment form, select a new category and submit. | **Pass**: All articles previously in the deleted category are moved to the new category (junction table updated); the old category is deleted; success message and redirect. **Fail**: Articles are orphaned (no category), reassignment targets wrong category, or old category persists. | Junction table records before and after; database showing category deleted; articles associated with new category. |
| VAL-CAT-043 | Delete category — requires authorization | Attempt deletion as a user without `can_delete_categories` permission. | **Pass**: Request is rejected with an authorization error. **Fail**: Unauthorized user can delete categories. | Error response/screenshot. |
| VAL-CAT-044 | Delete category — invalid ID | Navigate to the delete route with a non-numeric ID. | **Pass**: Redirected to the categories grid with an error flash message; no deletion occurs. **Fail**: Server error or unintended deletion. | Redirect URL; database integrity check. |

---

## 11. Tags

| ID | Title | Behavioral Description | Pass/Fail Condition | Evidence |
|----|-------|------------------------|---------------------|----------|
| VAL-TAG-001 | Tags created from article keywords on save | Create/edit an article with keywords (e.g., "php, javascript, testing"). Save. | **Pass**: Corresponding rows are created in the `tags` table (one per unique tag); junction rows in `article_tags` link each tag to the article via `tags_tag_id` and `tags_article_id`. **Fail**: Tags table has no new entries, or junction table has no rows for this article. | Database `tags` and `article_tags` records. |
| VAL-TAG-002 | Tags are deleted when article is deleted | Delete an article that has associated tags. | **Pass**: All rows in `article_tags` where `tags_article_id` matches the deleted article are removed. **Fail**: Orphaned `article_tags` rows remain. | Database `article_tags` query for the deleted article ID. |
| VAL-TAG-003 | Tag-based related articles | View an article that shares tags with other articles. | **Pass**: The related articles function returns articles that share at least one tag with the current article, excluding the current article itself. **Fail**: Related articles include the current article, or no related articles are returned despite shared tags. | API/function output. |
| VAL-TAG-004 | Tags many-to-many relationship integrity | One tag is used by multiple articles; one article has multiple tags. | **Pass**: The `article_tags` table correctly stores multiple rows per article (one per tag) and multiple rows per tag (one per article). Querying tags for an article returns all its tags; querying articles for a tag returns all its articles. **Fail**: Missing associations or duplicated entries. | Database `article_tags` records showing many-to-many relationships. |
| VAL-TAG-005 | Duplicate tags are not created | Save two articles with the same keyword (e.g., "php"). | **Pass**: Only one row exists in the `tags` table for "php"; both articles have junction rows pointing to the same `tags_tag_id`. **Fail**: Duplicate tag rows are created in the `tags` table. | Database `tags` table showing unique entries. |

---

## Summary

| Area | Assertion Count | ID Range |
|------|----------------|----------|
| Article Grid | 6 | VAL-ART-001 – VAL-ART-006 |
| Article Create | 11 | VAL-ART-010 – VAL-ART-020 |
| Article Edit | 6 | VAL-ART-030 – VAL-ART-035 |
| Article Delete | 2 | VAL-ART-040 – VAL-ART-041 |
| File Attachments | 6 | VAL-ART-050 – VAL-ART-055 |
| Category Grid | 7 | VAL-CAT-001 – VAL-CAT-007 |
| Category Create | 9 | VAL-CAT-010 – VAL-CAT-018 |
| Category Edit | 9 | VAL-CAT-020 – VAL-CAT-028 |
| Category Duplicate | 3 | VAL-CAT-030 – VAL-CAT-032 |
| Category Delete | 5 | VAL-CAT-040 – VAL-CAT-044 |
| Tags | 5 | VAL-TAG-001 – VAL-TAG-005 |
| **Total** | **69** | |
