# Filesystem Tool Implementation - READ-ONLY Phase

**Date:** October 13, 2025  
**Feature:** Filesystem Operations Tool (READ-ONLY Operations)  
**Status:** 📋 PLANNING PHASE  
**Priority:** High Security, Gradual Implementation  

---

## 🎯 OBJECTIVE

Implement secure READ-ONLY filesystem operations for the portal LLM:
- List directory contents
- Read file contents  
- Get file metadata/info
- Search files by name/pattern
- File type detection

**CRITICAL SECURITY PRINCIPLE:** READ-ONLY first, strict path validation, extensive logging.

---

## 📋 VERIFICATION - CURRENT SYSTEM STATE

### ✅ Tool System Architecture (VERIFIED)

**Files Examined:**
- `/lib/tools/types.ts` (90 lines) - ToolDefinition interface ✅
- `/lib/tools/config.ts` (85 lines) - Configuration pattern ✅  
- `/lib/tools/registry.ts` (218 lines) - Auto-registration system ✅

**Current Tools:**
- ✅ `calculator/` - Math operations
- ✅ `datetime/` - Date/time operations
- ✅ `web-search/` - Web search functionality

**Registration Pattern:** Auto-import and register in `registry.ts:210-217` ✅

### ✅ Integration Points Identified

1. **Tool Definition:** Must implement `ToolDefinition` interface
2. **Configuration:** Follow env-based config pattern in `config.ts`
3. **Registration:** Add import and `registerTool()` call in `registry.ts`
4. **Validation:** Use existing `toolValidator` for parameter validation
5. **Error Format:** Follow `[ToolName] ErrorCategory: message` standard

---

## 🗂️ PHASED IMPLEMENTATION PLAN

### **PHASE 1: Foundation & Security (Week 1)**

#### 1.1 Create Directory Structure
```bash
lib/tools/filesystem/
├── index.ts                     # ToolDefinition export
├── filesystem.config.ts         # Security config
├── filesystem.service.ts        # Main service
├── security/
│   ├── pathValidator.ts         # Path security validation
│   ├── permissionCheck.ts       # Permission validation  
│   └── sanitizer.ts            # Input sanitization
├── operations/
│   └── readOps.ts              # READ-ONLY operations
└── types/
    └── filesystem.types.ts      # TypeScript interfaces
```

#### 1.2 Security Foundation
**Files to Create:**
- `security/pathValidator.ts` - Prevent path traversal attacks
- `security/permissionCheck.ts` - Validate read permissions
- `security/sanitizer.ts` - Sanitize file paths and names

**Security Rules:**
- Whitelist allowed directories only
- Block `../`, `./`, absolute paths outside sandbox
- Validate file existence before operations  
- Log all filesystem access attempts

#### 1.3 Configuration Setup
**File:** `filesystem.config.ts`
```typescript
export const filesystemConfig = {
  enabled: process.env.TOOL_FILESYSTEM_ENABLED === 'true',
  allowedPaths: process.env.FILESYSTEM_ALLOWED_PATHS?.split(',') || ['/tmp/portal-sandbox'],
  maxFileSize: parseInt(process.env.FILESYSTEM_MAX_FILE_SIZE || '1048576'), // 1MB
  logOperations: process.env.FILESYSTEM_LOG_OPERATIONS !== 'false',
  readOnly: true, // Phase 1 restriction
};
```

### **PHASE 2: Core READ-ONLY Operations (Week 1)**

#### 2.1 List Directory Contents
**Operation:** `list_directory`
**Parameters:**
- `path` (string, required) - Directory to list
- `includeHidden` (boolean, optional) - Show hidden files

**Security Checks:**
- Validate path is within allowed directories
- Check read permissions
- Sanitize output

#### 2.2 Read File Contents  
**Operation:** `read_file`
**Parameters:**
- `path` (string, required) - File to read
- `encoding` (string, optional) - File encoding (utf-8, base64)
- `maxSize` (number, optional) - Max bytes to read

**Security Checks:**
- File size validation
- Encoding validation
- Text vs binary detection

#### 2.3 Get File Metadata
**Operation:** `file_info`  
**Parameters:**
- `path` (string, required) - File/directory path

**Returns:**
- Size, created/modified dates
- Permissions (read-only view)
- File type (extension, MIME type)
- Is file vs directory

### **PHASE 3: Advanced READ Operations (Week 2)**

#### 3.1 File Search by Name
**Operation:** `find_files`
**Parameters:**
- `directory` (string, required) - Search directory
- `pattern` (string, required) - Filename pattern/glob
- `recursive` (boolean, optional) - Search subdirectories

#### 3.2 File Content Search
**Operation:** `search_content`
**Parameters:**  
- `directory` (string, required) - Search directory
- `text` (string, required) - Text to search for
- `fileTypes` (array, optional) - Limit to file extensions

**Security:** Only search text files, skip binary files

### **PHASE 4: Integration & Testing (Week 2)**

#### 4.1 Tool Registration
- Add import to `/lib/tools/registry.ts`
- Register with `registerTool(filesystemTool)`
- Update environment variables

#### 4.2 Validation & Testing
- Parameter validation tests
- Security validation tests  
- Path traversal attack tests
- Permission boundary tests
- Error message format tests

#### 4.3 Documentation
- Update `HOW_TO_REPLACE_TOOLS.md`
- Create `FILESYSTEM_TOOL_GUIDE.md`
- Document security considerations

---

## 🛡️ SECURITY VALIDATION CHECKLIST

### Path Security
- [ ] Block `../` path traversal
- [ ] Validate against whitelist directories only
- [ ] Reject absolute paths outside sandbox
- [ ] Sanitize special characters in paths
- [ ] Log all path access attempts

### File Operations Security  
- [ ] Check file read permissions before access
- [ ] Validate file size limits
- [ ] Handle binary vs text files appropriately
- [ ] Prevent reading system/config files
- [ ] Rate limiting on operations

### Error Handling
- [ ] No sensitive path info in error messages
- [ ] Follow standard error format: `[Filesystem] ValidationError: message`
- [ ] Log security violations
- [ ] Graceful handling of permission denied

---

## 📊 IMPLEMENTATION VERIFICATION PLAN

### Pre-Implementation Checks
1. **Verify current tool system works** - Test existing calculator/datetime tools
2. **Validate TypeScript interfaces** - Ensure ToolDefinition compatibility
3. **Test tool registration** - Verify auto-registration pattern
4. **Check validation system** - Ensure parameter validation active

### Implementation Validation (Per Phase)
1. **Create minimal structure** - Verify directory creation
2. **Test security validators** - Unit test path validation
3. **Implement one operation** - Test list_directory first  
4. **Validate registration** - Ensure tool appears in registry
5. **Test error handling** - Verify error format compliance

### Security Testing
1. **Path traversal tests** - Attempt `../../../etc/passwd`
2. **Permission tests** - Try accessing restricted directories
3. **Input validation** - Test malformed parameters
4. **Error boundary tests** - Verify no sensitive data leaks

---

## 📝 FILES TO CREATE/MODIFY

### New Files (Phase 1-2)
| File | Purpose | Lines Est. |
|------|---------|-----------|
| `lib/tools/filesystem/index.ts` | Tool definition | ~80 |
| `lib/tools/filesystem/filesystem.config.ts` | Configuration | ~30 |
| `lib/tools/filesystem/filesystem.service.ts` | Main service | ~150 |
| `lib/tools/filesystem/security/pathValidator.ts` | Path security | ~100 |
| `lib/tools/filesystem/security/permissionCheck.ts` | Permissions | ~60 |
| `lib/tools/filesystem/security/sanitizer.ts` | Input sanitization | ~40 |
| `lib/tools/filesystem/operations/readOps.ts` | READ operations | ~200 |
| `lib/tools/filesystem/types/filesystem.types.ts` | Type definitions | ~50 |

### Files to Modify
| File | Change | Lines |
|------|--------|-------|
| `lib/tools/registry.ts` | Add import + register | +2 |
| `lib/tools/config.ts` | Export filesystem config | +1 |
| `.env` | Add FILESYSTEM env vars | +5 |

### Documentation Files
| File | Purpose |
|------|---------|
| `docs/FILESYSTEM_TOOL_IMPLEMENTATION.md` | Detailed implementation log |
| `docs/FILESYSTEM_SECURITY_GUIDE.md` | Security considerations |
| `docs/FILESYSTEM_API_REFERENCE.md` | API documentation |

---

## 🚦 ROLLBACK PLAN

If any phase fails:

### Phase 1 Rollback
```bash
rm -rf lib/tools/filesystem/
git checkout lib/tools/registry.ts
git checkout .env
```

### Phase 2+ Rollback  
```bash
# Disable in config
export TOOL_FILESYSTEM_ENABLED=false
# Or remove registration
# Remove import from registry.ts
```

---

## 🎯 SUCCESS CRITERIA

### Phase 1 Complete When:
- [ ] Directory structure created
- [ ] Security validators implemented and tested
- [ ] Configuration system working
- [ ] No TypeScript compilation errors

### Phase 2 Complete When:
- [ ] All READ operations implemented  
- [ ] Tool registered and discoverable
- [ ] Parameter validation working
- [ ] Error messages standardized
- [ ] Security tests passing

### Phase 3 Complete When:
- [ ] Advanced search operations working
- [ ] Performance acceptable (<2s response)
- [ ] Memory usage reasonable
- [ ] All security tests passing

### Overall Success When:
- [ ] LLM can list directories securely
- [ ] LLM can read file contents safely
- [ ] LLM can search files appropriately
- [ ] No security vulnerabilities identified
- [ ] Tool works reliably in production

---

## ⚠️ RISK MITIGATION

### High Risk: Security Vulnerabilities
**Mitigation:** Extensive security testing, whitelist-only approach, read-only operations

### Medium Risk: Performance Issues  
**Mitigation:** File size limits, operation timeouts, efficient algorithms

### Low Risk: Integration Issues
**Mitigation:** Follow existing patterns, extensive testing, gradual rollout

---

## 📈 TIMELINE

**Week 1:**
- Days 1-2: Phase 1 (Foundation & Security)
- Days 3-4: Phase 2 (Core Operations)  
- Day 5: Testing & Security Validation

**Week 2:**
- Days 1-2: Phase 3 (Advanced Operations)
- Days 3-4: Phase 4 (Integration & Testing)
- Day 5: Documentation & Review

**Total Estimated Time:** 10 days
**Ready for Production:** End of Week 2

---

## 🔄 SESSION CONTINUITY

**Previous Context:**
- Tool system improvements completed (Task 1-3)
- Error message standardization implemented
- Tool validation system active
- Registry auto-registration working

**Current Context:**  
- Planning READ-ONLY filesystem tool
- Security-first approach
- Phased implementation strategy
- Following existing tool patterns

**Next Session Context:**
- Implementation plan approved/modified
- Begin Phase 1 implementation
- Security validator creation
- First operation testing

---

**Status:** 📋 READY FOR APPROVAL  
**Next Step:** Awaiting user approval to begin Phase 1 implementation  
**Estimated Start:** Upon approval  
**Risk Level:** LOW (READ-ONLY operations, extensive security measures)
