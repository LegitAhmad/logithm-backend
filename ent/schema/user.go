package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type User struct{ ent.Schema }

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").NotEmpty().Unique().Immutable(),
		field.String("display_name").NotEmpty(),
		field.String("password_hash").Sensitive(),
		field.Time("created_at").Immutable(),
		field.Time("updated_at"),
	}
}
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("memberships", CourseMembership.Type),
		edge.To("owned_courses", Course.Type),
		edge.To("refresh_sessions", RefreshSession.Type),
	}
}
func (User) Indexes() []ent.Index { return []ent.Index{index.Fields("email")} }
