package types

import (
	"context"

	"github.com/vitwit/healthlock/tee-client/config"
	"github.com/vitwit/healthlock/tee-client/keys"
)

type Context struct {
	baseCtx context.Context

	config *config.Config

	keyPairs *keys.KeyPair
}

// New creates a new builder starting from context.Background()
func NewContext() *Context {
	return &Context{
		baseCtx: context.Background(),
	}
}

func (b *Context) Context() context.Context {
	return b.baseCtx
}

// Attach config to the builder
func (b *Context) WithConfig(cfg *config.Config) *Context {
	b.config = cfg
	return b
}

// Attach keypairs
func (b *Context) WithKeyPairs(kp *keys.KeyPair) *Context {
	b.keyPairs = kp
	return b
}

func (b *Context) GetConfig() *config.Config {
	return b.config
}
