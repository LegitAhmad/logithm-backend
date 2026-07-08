package schema

import "entgo.io/ent"

// Question holds the schema definition for the Question entity.
type Question struct {
	ent.Schema
}

// Fields of the Question.
func (Question) Fields() []ent.Field {
	return nil
}

// Edges of the Question.
func (Question) Edges() []ent.Edge {
	return nil
}
