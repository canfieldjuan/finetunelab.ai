#!/bin/bash

# ============================================================================
# Test Signup Flow - Verification Script
# ============================================================================

echo "🧪 Testing Signup Flow Implementation"
echo "======================================"
echo ""

# Test 1: Check if migration file exists
echo "1. Checking migration file..."
if [ -f "migrations/create_user_profiles.sql" ]; then
    echo "   ✓ Migration file exists"
else
    echo "   ✗ Migration file not found"
    exit 1
fi

# Test 2: Check AuthContext exports
echo ""
echo "2. Checking AuthContext exports..."
if grep -q "export interface UserProfileData" contexts/AuthContext.tsx; then
    echo "   ✓ UserProfileData interface exported"
else
    echo "   ✗ UserProfileData interface not exported"
    exit 1
fi

if grep -q "signUp.*profileData.*UserProfileData" contexts/AuthContext.tsx; then
    echo "   ✓ signUp function signature updated"
else
    echo "   ✗ signUp function signature not updated"
    exit 1
fi

# Test 3: Check signup page imports
echo ""
echo "3. Checking signup page imports..."
if grep -q "UserProfileData.*AuthContext" app/signup/page.tsx; then
    echo "   ✓ UserProfileData imported in signup page"
else
    echo "   ✗ UserProfileData not imported"
    exit 1
fi

if grep -q "Select" app/signup/page.tsx; then
    echo "   ✓ Select component imported"
else
    echo "   ✗ Select component not imported"
    exit 1
fi

# Test 4: Check required fields in signup page
echo ""
echo "4. Checking form fields..."
required_fields=("firstName" "lastName" "companyName" "roleInCompany" "finetuningType")
all_found=true

for field in "${required_fields[@]}"; do
    if grep -q "const \[$field" app/signup/page.tsx; then
        echo "   ✓ $field state exists"
    else
        echo "   ✗ $field state missing"
        all_found=false
    fi
done

if ! $all_found; then
    exit 1
fi

# Test 5: Check validation logic
echo ""
echo "5. Checking validation logic..."
if grep -q "Validate required fields" app/signup/page.tsx; then
    echo "   ✓ Required field validation exists"
else
    echo "   ✗ Required field validation missing"
    exit 1
fi

if grep -q "emailRegex.*test" app/signup/page.tsx; then
    echo "   ✓ Email validation exists"
else
    echo "   ✗ Email validation missing"
    exit 1
fi

# Test 6: Check TypeScript compilation
echo ""
echo "6. Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS" && {
    echo "   ✗ TypeScript compilation errors found"
    npx tsc --noEmit --skipLibCheck 2>&1 | head -20
    exit 1
} || {
    echo "   ✓ No TypeScript compilation errors"
}

# Test 7: Summary
echo ""
echo "======================================"
echo "✅ All pre-deployment checks passed!"
echo ""
echo "Next steps:"
echo "  1. Apply migration: Run migrations/create_user_profiles.sql in Supabase SQL Editor"
echo "  2. Test manually: Visit /signup and test form submission"
echo "  3. Verify data: Check user_profiles table after signup"
echo ""
