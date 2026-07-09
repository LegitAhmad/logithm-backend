package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type RefreshSession struct{ ent.Schema }

func (RefreshSession) Fields() []ent.Field {
	return []ent.Field{field.String("session_id").Unique().Immutable(), field.String("family_id").Immutable(), field.String("token_hash").Sensitive(), field.Int("user_id"), field.Time("expires_at"), field.Time("revoked_at").Optional().Nillable(), field.Time("created_at").Immutable()}
}
func (RefreshSession) Edges() []ent.Edge {
	return []ent.Edge{edge.From("user", User.Type).Ref("refresh_sessions").Field("user_id").Unique().Required()}
}
func (RefreshSession) Indexes() []ent.Index {
	return []ent.Index{index.Fields("session_id"), index.Fields("family_id")}
}
