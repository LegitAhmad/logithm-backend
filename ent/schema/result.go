package schema

import "entgo.io/ent"

// Result holds the schema definition for the Result entity.
type Result struct {
	ent.Schema
}

// Fields of the Result.
func (Result) Fields() []ent.Field {
	return nil
}

// Edges of the Result.
func (Result) Edges() []ent.Edge {
	return nil
}
