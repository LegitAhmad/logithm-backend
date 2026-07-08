package schema

import "entgo.io/ent"

// Teacher holds the schema definition for the Teacher entity.
type Teacher struct {
	ent.Schema
}

// Fields of the Teacher.
func (Teacher) Fields() []ent.Field {
	return nil
}

// Edges of the Teacher.
func (Teacher) Edges() []ent.Edge {
	return nil
}
