GO := go
TARGET := tee-client
BINDIR ?= $(GOPATH)/bin

# TEE options
BUILD_TAG ?= mock  # Default to mock for local testing

.PHONY: all build build_amd build_intel build_mock install clean

all: build

# Default build = mock
build:
	$(GO) build -o $(TARGET) -tags '$(BUILD_TAG)'

# AMD-specific build
build_amd:
	$(MAKE) build BUILD_TAG=amd

# Intel-specific build (stub)
build_intel:
	$(MAKE) build BUILD_TAG=intel

# Local development build (explicit)
build_mock:
	$(MAKE) build BUILD_TAG=mock

install: build
	@echo "Installing $(TARGET) to $(BINDIR)"
	@cp $(TARGET) $(BINDIR)

install_amd: build_amd
	@echo "Installing $(TARGET) to $(BINDIR)"
	@cp $(TARGET) $(BINDIR)

install_intel: build_intel
	@echo "Installing $(TARGET) to $(BINDIR)"
	@cp $(TARGET) $(BINDIR)

install_mock: build_mock
	@echo "Installing $(TARGET) to $(BINDIR)"
	@cp $(TARGET) $(BINDIR)

clean:
	@echo "Cleaning up"
	rm -f $(TARGET)

