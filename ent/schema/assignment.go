package schema

import "entgo.io/ent"

// Assignment holds the schema definition for the Assignment entity.
type Assignment struct {
	ent.Schema
}

// Fields of the Assignment.
func (Assignment) Fields() []ent.Field {
	return nil
}

// Edges of the Assignment.
func (Assignment) Edges() []ent.Edge {
	return nil
}
