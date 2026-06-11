import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuantityModal from '../../components/QuantityModal';

describe('QuantityModal', () => {
  const mockOnValidate = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly when visible', () => {
    const { getByText } = render(
      <QuantityModal
        visible={true}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Entrer la quantité')).toBeTruthy();
  });

  it('should display product name when provided', () => {
    const { getByText } = render(
      <QuantityModal
        visible={true}
        productName="Coca Cola"
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Quantité pour Coca Cola')).toBeTruthy();
  });

  it('should display initial value', () => {
    const { getByDisplayValue } = render(
      <QuantityModal
        visible={true}
        initialValue={5}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    expect(getByDisplayValue('5')).toBeTruthy();
  });

  it('should call onValidate with quantity when validating', () => {
    const { getByText, getByDisplayValue } = render(
      <QuantityModal
        visible={true}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    const input = getByDisplayValue('0');
    fireEvent.changeText(input, '10');

    const validateBtn = getByText('Valider');
    fireEvent.press(validateBtn);

    expect(mockOnValidate).toHaveBeenCalledWith(10);
  });

  it('should call onCancel when cancel button is pressed', () => {
    const { getByText } = render(
      <QuantityModal
        visible={true}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    const cancelBtn = getByText('Annuler');
    fireEvent.press(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should filter non-numeric characters from input', () => {
    const { getByDisplayValue } = render(
      <QuantityModal
        visible={true}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    const input = getByDisplayValue('0');
    fireEvent.changeText(input, '12abc34');

    expect(getByDisplayValue('1234')).toBeTruthy();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <QuantityModal
        visible={false}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    expect(queryByText('Entrer la quantité')).toBeNull();
  });

  it('should reset quantity to initial value when cancelled', () => {
    const { getByText, getByDisplayValue } = render(
      <QuantityModal
        visible={true}
        initialValue={5}
        onValidate={mockOnValidate}
        onCancel={mockOnCancel}
      />
    );

    const input = getByDisplayValue('5');
    fireEvent.changeText(input, '20');

    const cancelBtn = getByText('Annuler');
    fireEvent.press(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});