package api

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
)

// shared form format with explicit schema versioning
type FormDefinition struct {
	SchemaVersion int           `json:"schemaVersion"`
	Sections      []FormSection `json:"sections"`
}

type FormSection struct {
	ID     string      `json:"id"`
	Title  string      `json:"title"`
	Fields []FormField `json:"fields"`
}

type FormField struct {
	ID        string   `json:"id"`
	Label     string   `json:"label"`
	Type      string   `json:"type"`
	Widget    string   `json:"widget,omitempty"`
	Required  bool     `json:"required,omitempty"`
	Minimum   *float64 `json:"minimum,omitempty"`
	Maximum   *float64 `json:"maximum,omitempty"`
	MaxLength *int     `json:"maxLength,omitempty"`
	Options   []string `json:"options,omitempty"`
}

var formIdentifier = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)

func validateDefinition(d FormDefinition) error {
	if d.SchemaVersion != 1 {
		return fmt.Errorf("schemaVersion must be 1")
	}
	if len(d.Sections) == 0 || len(d.Sections) > 30 {
		return fmt.Errorf("sections must contain 1 to 30 sections")
	}
	sections, fields := map[string]bool{}, map[string]bool{}
	for si, section := range d.Sections {
		path := fmt.Sprintf("sections[%d]", si)
		if !formIdentifier.MatchString(section.ID) || sections[section.ID] {
			return fmt.Errorf("%s.id must be a unique lowercase identifier", path)
		}
		sections[section.ID] = true
		if strings.TrimSpace(section.Title) == "" || len(section.Title) > 200 || len(section.Fields) == 0 {
			return fmt.Errorf("%s requires a title (up to 200 bytes) and fields", path)
		}
		for fi, field := range section.Fields {
			path := fmt.Sprintf("%s.fields[%d]", path, fi)
			if !formIdentifier.MatchString(field.ID) || fields[field.ID] {
				return fmt.Errorf("%s.id must be unique across the form and a lowercase identifier", path)
			}
			fields[field.ID] = true
			if len(fields) > 300 || strings.TrimSpace(field.Label) == "" || len(field.Label) > 300 {
				return fmt.Errorf("%s requires a label up to 300 bytes; forms support at most 300 fields", path)
			}
			numeric := field.Type == "integer" || field.Type == "number"
			choice := field.Type == "single_choice" || field.Type == "multiple_choice"
			switch field.Type {
			case "text", "integer", "number", "boolean", "single_choice", "multiple_choice":
			default:
				return fmt.Errorf("%s.type is unsupported", path)
			}
			validWidget := field.Widget == "" || (field.Type == "text" && field.Widget == "textarea") ||
				(field.Type == "integer" && field.Widget == "counter") || (field.Type == "boolean" && field.Widget == "toggle")
			if !validWidget {
				return fmt.Errorf("%s.widget is incompatible with type", path)
			}
			if !numeric && (field.Minimum != nil || field.Maximum != nil) {
				return fmt.Errorf("%s minimum/maximum require a numeric type", path)
			}
			if field.Minimum != nil && field.Maximum != nil && *field.Minimum > *field.Maximum {
				return fmt.Errorf("%s minimum exceeds maximum", path)
			}
			if field.MaxLength != nil && (field.Type != "text" || *field.MaxLength < 1 || *field.MaxLength > 20000) {
				return fmt.Errorf("%s.maxLength requires text and a value between 1 and 20000", path)
			}
			if choice {
				if len(field.Options) == 0 || len(field.Options) > 100 {
					return fmt.Errorf("%s.options must contain 1 to 100 choices", path)
				}
				seen := map[string]bool{}
				for _, option := range field.Options {
					if strings.TrimSpace(option) == "" || len(option) > 200 || seen[option] {
						return fmt.Errorf("%s.options must be nonempty, unique, and up to 200 bytes each", path)
					}
					seen[option] = true
				}
			} else if len(field.Options) != 0 {
				return fmt.Errorf("%s.options require a choice type", path)
			}
		}
	}
	return nil
}

func validateAnswers(d FormDefinition, answers map[string]json.RawMessage) error {
	if answers == nil {
		return fmt.Errorf("answers must be an object")
	}
	known := map[string]bool{}
	for _, section := range d.Sections {
		for _, field := range section.Fields {
			known[field.ID] = true
			raw, exists := answers[field.ID]
			if !exists || string(raw) == "null" {
				if field.Required {
					return fmt.Errorf("answers.%s is required", field.ID)
				}
				continue
			}
			var value any
			if err := json.Unmarshal(raw, &value); err != nil {
				return fmt.Errorf("answers.%s is invalid JSON", field.ID)
			}
			valid := true
			switch field.Type {
			case "text":
				v, ok := value.(string)
				limit := 20000
				if field.MaxLength != nil {
					limit = *field.MaxLength
				}
				valid = ok && len([]rune(v)) <= limit && (!field.Required || strings.TrimSpace(v) != "")
			case "integer", "number":
				v, ok := value.(float64)
				valid = ok && (field.Type != "integer" || (math.Trunc(v) == v && math.Abs(v) <= 9007199254740991)) &&
					(field.Minimum == nil || v >= *field.Minimum) && (field.Maximum == nil || v <= *field.Maximum)
			case "boolean":
				_, valid = value.(bool)
			case "single_choice":
				v, ok := value.(string)
				valid = ok && hasFormOption(field.Options, v)
			case "multiple_choice":
				v, ok := value.([]any)
				valid = ok && (!field.Required || len(v) > 0)
				seen := map[string]bool{}
				for _, item := range v {
					s, ok := item.(string)
					if !ok || seen[s] || !hasFormOption(field.Options, s) {
						valid = false
					}
					seen[s] = true
				}
			}
			if !valid {
				return fmt.Errorf("answers.%s has an invalid type, choice, or value", field.ID)
			}
		}
	}
	for key := range answers {
		if !known[key] {
			return fmt.Errorf("answers.%s is not defined in this version", key)
		}
	}
	return nil
}

func hasFormOption(options []string, value string) bool {
	for _, option := range options {
		if option == value {
			return true
		}
	}
	return false
}
