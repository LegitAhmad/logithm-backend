package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Course struct{ ent.Schema }

func (Course) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(), field.String("description").Default(""),
		field.String("join_code").NotEmpty().Unique().Immutable(),
		field.Int("owner_id"), field.Time("created_at").Immutable(), field.Time("updated_at"),
	}
}
func (Course) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("owned_courses").Field("owner_id").Unique().Required(),
		edge.To("memberships", CourseMembership.Type), edge.To("teacher_invitations", TeacherInvitation.Type),
	}
}
func (Course) Indexes() []ent.Index { return []ent.Index{index.Fields("join_code")} }
