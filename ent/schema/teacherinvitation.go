package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type TeacherInvitation struct{ ent.Schema }

func (TeacherInvitation) Fields() []ent.Field {
	return []ent.Field{field.String("email").NotEmpty(), field.String("token_hash").Sensitive().Unique(), field.String("status").Default("pending"), field.Int("course_id"), field.Time("expires_at"), field.Time("accepted_at").Optional().Nillable(), field.Time("revoked_at").Optional().Nillable(), field.Time("created_at").Immutable()}
}
func (TeacherInvitation) Edges() []ent.Edge {
	return []ent.Edge{edge.From("course", Course.Type).Ref("teacher_invitations").Field("course_id").Unique().Required()}
}
