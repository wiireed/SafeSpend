// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice PolicyVault — full implementation lands in PR 2 against
///         docs/24-hour-build-plan.md. This file only pins the
///         constructor signature so other packages can compile against
///         the shape during PR 1.
contract PolicyVault {
    IERC20 public immutable usdc;

    constructor(IERC20 _usdc) {
        usdc = _usdc;
    }
}
