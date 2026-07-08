package schema

import "entgo.io/ent"

// Submission holds the schema definition for the Submission entity.
type Submission struct {
	ent.Schema
}

// Fields of the Submission.
func (Submission) Fields() []ent.Field {
	return nil
}

// Edges of the Submission.
func (Submission) Edges() []ent.Edge {
	return nil
}
