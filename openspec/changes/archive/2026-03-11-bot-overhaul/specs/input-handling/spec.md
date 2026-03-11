## ADDED Requirements

### Requirement: Input normalization
The system SHALL normalize all incoming user text before processing: trim whitespace, convert to lowercase, and strip diacritics/accents (NFD decomposition with combining mark removal). The normalized form SHALL be used for all command matching and keyword recognition.

#### Scenario: Case-insensitive greeting
- **WHEN** a user sends "HOLA", "hola", "Hola", or "hOlA"
- **THEN** the system recognizes all as the "hola" keyword and responds with the welcome message

#### Scenario: Accent-insensitive matching
- **WHEN** a user sends "SI" or "si" (without accent) in response to a yes/no prompt
- **THEN** the system recognizes it the same as "si" and processes accordingly

### Requirement: Global keyword intercepts
The system SHALL recognize global keywords at any point in the conversation, regardless of the user's current state. These keywords SHALL be processed before state-specific handling.

- `hola`, `menu`, `pedir` — restart the ordering flow from welcome
- `cancelar` — cancel current order, clear state, confirm cancellation
- `ayuda` — show help text with available commands

#### Scenario: User says "menu" mid-order
- **WHEN** a user is in CART_CONFIRM state and sends "menu"
- **THEN** the system restarts from the welcome/menu display, preserving no cart data

#### Scenario: User says "cancelar" during checkout
- **WHEN** a user is in NOTES state and sends "cancelar"
- **THEN** the system clears their state, sends a cancellation confirmation message, and does not create any order

#### Scenario: User says "ayuda" at any point
- **WHEN** a user sends "ayuda" in any state
- **THEN** the system sends a help message listing available commands (hola, menu, cancelar, ayuda) without changing their current state

### Requirement: Numeric input parsing
The system SHALL parse numeric input from user messages. A message containing only a number (e.g., "1", "2", "03") SHALL be treated as a menu selection. Leading zeros SHALL be stripped.

#### Scenario: User selects option with leading zero
- **WHEN** a user sends "03" when viewing a numbered menu
- **THEN** the system treats it as selection 3

### Requirement: Interactive message response extraction
The system SHALL extract user input from interactive message responses (list selections via `listResponseMessage.singleSelectReply.selectedRowId`, button taps via `buttonsResponseMessage.selectedButtonId`) in addition to plain text messages. Both interactive responses and typed text SHALL be processed through the same handler logic using the `rowId`/`buttonId` as the equivalent of typed input.

#### Scenario: User taps a list row
- **WHEN** a user taps "Truchas" in an interactive list message with rowId "3"
- **THEN** the system processes it identically to the user having typed "3"

#### Scenario: User taps a button
- **WHEN** a user taps "Finalizar pedido" button with buttonId "finalizar"
- **THEN** the system processes it identically to the mapped action for that button

#### Scenario: User types instead of tapping
- **WHEN** a user types "3" as plain text instead of tapping the list
- **THEN** the system processes it the same as tapping the list row with rowId "3"
The system SHALL recognize quantity patterns in the CHOOSE_QUANTITY state: plain numbers ("2", "3"), and common patterns ("x2", "2x"). The default quantity if no quantity pattern is recognized SHALL be 1.

#### Scenario: User enters quantity with x-prefix
- **WHEN** a user is in CHOOSE_QUANTITY state and sends "x3"
- **THEN** the system sets the quantity to 3

#### Scenario: User enters plain number as quantity
- **WHEN** a user is in CHOOSE_QUANTITY state and sends "2"
- **THEN** the system sets the quantity to 2
