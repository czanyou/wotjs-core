#ifndef MOCK_FENV_H
#define MOCK_FENV_H

enum {
    FE_TONEAREST =
#define FE_TONEAREST 0
        FE_TONEAREST,
    FE_DOWNWARD =
#define FE_DOWNWARD 0x400
        FE_DOWNWARD,
    FE_UPWARD =
#define FE_UPWARD 0x800
        FE_UPWARD,
    FE_TOWARDZERO =
#define FE_TOWARDZERO 0xc00
        FE_TOWARDZERO
};

int fesetround(int rdir);

#endif // MOCK_FENV_H
