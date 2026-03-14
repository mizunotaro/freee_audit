import { ddValidationEngine } from './validation-engine'
import { TaxValidator } from './tax-validator'
import { RelatedPartyValidator } from './related-party-validator'
import { InternalControlsValidator } from './internal-controls-validator'

import { RevenueRecognitionValidator } from './revenue-validator'
import { AccountsReceivableValidator } from './ar-validator'
import { InventoryValidator } from './inventory-validator'

export function initializeAllValidators(): void {
  ddValidationEngine.registerValidator(new RevenueRecognitionValidator())
  ddValidationEngine.registerValidator(new AccountsReceivableValidator())
  ddValidationEngine.registerValidator(new InventoryValidator())
  ddValidationEngine.registerValidator(new TaxValidator())
  ddValidationEngine.registerValidator(new RelatedPartyValidator())
  ddValidationEngine.registerValidator(new InternalControlsValidator())
}

export {
  ddValidationEngine,
  TaxValidator,
  RelatedPartyValidator,
  InternalControlsValidator,
  RevenueRecognitionValidator,
  AccountsReceivableValidator,
  InventoryValidator,
}
