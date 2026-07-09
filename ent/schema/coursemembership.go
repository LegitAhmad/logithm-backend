package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CourseMembership struct{ ent.Schema }

func (CourseMembership) Fields() []ent.Field {
	return []ent.Field{field.Enum("role").Values("owner", "teacher", "student"), field.Int("user_id"), field.Int("course_id"), field.Time("created_at").Immutable()}
}
func (CourseMembership) Edges() []ent.Edge {
	return []ent.Edge{edge.From("user", User.Type).Ref("memberships").Field("user_id").Unique().Required(), edge.From("course", Course.Type).Ref("memberships").Field("course_id").Unique().Required()}
}
func (CourseMembership) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "course_id").Unique()}
}
