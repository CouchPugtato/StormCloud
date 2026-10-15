# Versioned forms API

Step 1 adds storage and authenticated APIs alongside the existing scouting system.
The current frontend, legacy endpoints, exports, graphs, and leaderboard continue
using their existing tables. They do not consume these new submissions yet.
There is no editor, file-picker UI, event assignment, or cloud deployment in this step.

The server applies migration `019_versioned_forms.sql` on startup. It creates
separate form, version, and submission tables and leaves existing scouting data
in place. Tests cover upgrading from migration 018 and reapplying migrations.
The initial schema also now defines the three team robot columns required by
the existing migration 004, allowing a fresh database to initialize.

## Authorization

Every endpoint uses the existing `Authorization: Bearer <session-token>` header.

| Action | Roles |
| --- | --- |
| Create forms, create/edit drafts, publish | `scouting_lead` |
| Read drafts | `scouting_lead` |
| Read published forms and versions | Any signed-in user |
| Submit answers | `scouter`, `scouting_lead` |
| Read all submissions | `scouting_lead`, `drive_team` |
| Read own submissions | Other signed-in users |

The server derives scout ownership from the session. Clients cannot supply it.

## Form definition format

Metadata (`name`, `season`, `kind`) belongs to the form. Its versioned
`definition` contains `schemaVersion` and `sections`:

```json
{
  "name": "2026 Match Scouting",
  "season": 2026,
  "kind": "match",
  "definition": {
    "schemaVersion": 1,
    "sections": [
      {
        "id": "performance",
        "title": "Robot Performance",
        "fields": [
          {
            "id": "cycles",
            "label": "Completed cycles",
            "type": "integer",
            "widget": "counter",
            "required": true,
            "minimum": 0
          },
          {
            "id": "disabled",
            "label": "Was the robot disabled?",
            "type": "boolean",
            "widget": "toggle",
            "required": true
          }
        ]
      }
    ]
  }
}
```

Send this object to `POST /api/forms` to atomically create a form and its first
draft. The response is `201 {"form": {...}, "version": {...}}`.
Forms have kind `match`, `pit`, or `alliance` and a season from 1992 to 9999.

Definitions currently support:

| Type | Optional configuration |
| --- | --- |
| `text` | `widget: "textarea"`, `maxLength` (1–20000 characters) |
| `integer` | `widget: "counter"`, `minimum`, `maximum` |
| `number` | `minimum`, `maximum` |
| `boolean` | `widget: "toggle"` |
| `single_choice` | Required nonempty `options` array of unique strings |
| `multiple_choice` | Required nonempty `options` array of unique strings |

All fields require `id`, `label`, and `type`; `required` defaults to false.
IDs must match `[a-z][a-z0-9_]{0,63}`. Section IDs are unique; field IDs are
unique across the whole form. Keep a field ID when relabeling the same question;
use a new ID when its meaning or type changes. This semantic decision belongs
to the form author; the API cannot infer question meaning.

Limits: 30 sections, 300 fields, 100 choices per choice field, 1 MiB per request.
Text answers default to a 20000-character limit. Integers must be within
JavaScript's safe integer range. Unknown request/definition properties,
unsupported schema versions, and incompatible widgets are rejected.
Conditional visibility and file/image fields are reserved for future work.

## Endpoints

Paths below assume the default `/api` prefix; `API_BASE_PATH` remains supported.
IDs in paths are UUIDs, including `version_id` (not the numeric version number).

| Method | Path | Request / result |
| --- | --- | --- |
| GET | `/forms` | Form array; optional `season`, `kind` filters |
| POST | `/forms` | Metadata and definition above; returns form and first draft |
| GET | `/forms/{form_id}` | Form metadata |
| GET | `/forms/{form_id}/versions` | Versions, newest numeric version first |
| POST | `/forms/{form_id}/versions` | `{"definition": {...}}`; returns a new draft |
| GET | `/forms/{form_id}/versions/{version_id}` | Definition, status, numeric version, revision, audit timestamps |
| PUT | `/forms/{form_id}/versions/{version_id}` | `{"revision": 1, "definition": {...}}`; replace a draft definition |
| POST | `/forms/{form_id}/versions/{version_id}/publish` | `{"revision": 2}`; publish the draft |
| POST | `/form-submissions` | Submission below |
| GET | `/form-submissions` | Submission array; optional `version_id`, `event_key`, `team_key`, `match_key` filters |

All array endpoints accept `limit` (1–100, default 100) and nonnegative `offset`.
Submissions are ordered by creation time descending, then ID. Empty results are
`[]`. Draft definitions are never included in responses to non-leads.

Every draft edit and publish increments `revision`. Send the revision last read;
a stale revision or an attempt to modify/publish an already published version
returns `409`. Published versions are immutable, enforced by database triggers.
To revise a published form, fetch its definition and POST a modified copy to the
versions endpoint. Older versions remain readable and accept submissions so
in-progress/offline scouting can finish against the original definition.
There is no automatically selected active form version yet.

## Submissions and retries

```json
{
  "id": "25356a09-1458-4944-a735-a51c4d0fe8da",
  "version_id": "<published-version-uuid>",
  "event_key": "2026test",
  "team_key": "frc509",
  "match_key": "2026test_qm1",
  "answers": {"cycles": 0, "disabled": false}
}
```

Generate `id` on the client and retain it with the queued payload. First save
returns `201`; resending the same ID, owner, context, version, and answers returns
the existing record with `200`. Reusing the ID for different data returns `409`.
Answer object key order and JSON whitespace do not affect retry comparison.
Different IDs create separate records, even for the same scout and match;
editing/replacing an earlier report is not implemented in this step.

All submissions require an existing event matching the form season:

- `match`: existing `team_key` and `match_key`; no alliance color.
- `pit`: existing `team_key`; no match key or alliance color.
- `alliance`: existing `match_key` and `alliance_color` (`red`/`blue`); no team key.

The match must belong to the event. Team existence is checked; membership in an
event or match alliance is not currently enforced. Context is stored in indexed
columns; answers are JSON stored as SQLite text. Answers are validated against
the exact published version: required values, types, numeric bounds, text limits,
choice membership, duplicate selections, and unknown fields. False and zero are
valid required values. Omitted/null optional values are accepted.

Errors return `{"error": "..."}`: `400` invalid input, `401` missing/invalid
session, `403` role denied, `404` unavailable form/version, `409` conflicting
revision or retry ID, `413` oversized request. Validation errors identify the
section/field path or answer ID.

## Verification

From `stormcloud`, run `go test ./...` and `go vet ./...`. Tests use temporary
SQLite databases with the real migration chain and bearer sessions. They cover
permissions, draft visibility, publication immutability, stale revisions,
definition/answer validation, event context, duplicate retries, ownership,
and preservation of legacy scouting data during migration 019.
