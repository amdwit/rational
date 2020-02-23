import { D, Decimal } from '../decimal/Decimal'
import { abs, divide, e, gcd, RoundMethod } from '../bigint/bigint'
import selfReplacing from '../selfReplacing'

export type RationalJson = string

export class Rational {
  public static readonly ZERO: Rational = new Rational(BigInt(0))
  public static readonly ONE: Rational = new Rational(BigInt(1))
  private static readonly cache: Map<
    string | number | Decimal,
    Rational
  > = new Map()
  private static cacheHits: Map<string | number | Decimal, Rational> = new Map()

  private readonly numerator: bigint
  private readonly denominator: bigint

  private constructor(numerator: bigint, denominator: bigint = BigInt(1)) {
    this.numerator = numerator
    this.denominator = denominator
  }

  private static addToCache(
    rational: Rational,
    key: string | number | Decimal
  ) {
    return
    // if (!(Rational.cache.size % 1e3)) {
    //   console.log('Rational.cache.size', Rational.cache.size, ', Rational.cacheHits.size', Rational.cacheHits.size)
    // }
    if (Rational.cache.size === 2 ** 16) {
      // console.log('cleaning up: Rational.cacheHits.size', Rational.cacheHits.size)
      for (const [key, rational] of Rational.cacheHits) {
        Rational.cache.delete(key)
        Rational.cache.set(key, rational)
      }
      Rational.cacheHits.clear()
      let length = 2 ** 12
      const keysIterator = Rational.cache.keys()
      while (length--) {
        const key = keysIterator.next().value
        Rational.cache.delete(key)
      }
    }
    Rational.cache.set(key, rational)
  }

  private static getFromCache(key: string | number | Decimal): Rational | null {
    const rational = Rational.cache.get(key)
    if (rational) {
      Rational.cacheHits.set(key, rational)
      return rational
    } else {
      return null
    }
  }

  public static fromJson(numberString: RationalJson): Rational {
    let rational = Rational.getFromCache(numberString)
    if (!rational) {
      const [numerator, denominator] = numberString.split('/')
      rational = Rational.create(BigInt(numerator), BigInt(denominator))
      Rational.addToCache(rational, numberString)
    }
    return rational
  }

  public static fromString(numberString: string): Rational {
    let rational = Rational.getFromCache(numberString)
    if (!rational) {
      const [numeratorString, denominatorString] = numberString.split('/')
      rational = Rational.fromDecimal(Decimal.fromString(numeratorString))
      if (denominatorString) {
        rational = rational.div(
          Rational.fromDecimal(Decimal.fromString(denominatorString))
        )
      }
      Rational.addToCache(rational, numberString)
    }
    return rational
  }

  public static fromNumber(n: number): Rational {
    let rational = Rational.getFromCache(n)
    if (!rational) {
      rational = Rational.fromDecimal(D(n))
      Rational.addToCache(rational, n)
    }
    return rational
  }

  public static fromDecimal(decimal: Decimal): Rational {
    let rational = Rational.getFromCache(decimal.string)
    if (!rational) {
      rational = Rational.create(
        e(decimal.significand, decimal.exponent > 0 ? decimal.exponent : 0),
        e(BigInt(1), decimal.exponent < 0 ? -decimal.exponent : 0)
      )
      Rational.addToCache(rational, decimal.string)
    }
    return rational
  }

  public static min(...rationals: Rational[]): Rational {
    return rationals.reduce((result, rational) =>
      result.lt(rational) ? result : rational
    )
  }

  public static max(...rationals: Rational[]): Rational {
    return rationals.reduce((result, rational) =>
      result.gt(rational) ? result : rational
    )
  }

  public static sum(...rationals: Rational[]): Rational {
    return rationals.reduce(
      (result, rational) => result.add(rational),
      Rational.ZERO
    )
  }

  public static avg(...rationals: Rational[]): Rational {
    return Rational.sum(...rationals).div(R(rationals.length))
  }

  public static median(...rationals: Rational[]): Rational {
    if (rationals.length) {
      const sorted = rationals.sort((a: Rational, b: Rational) => a.cmp(b))
      const half = sorted.length >> 1
      return sorted.length & 1
        ? sorted[half]
        : Rational.avg(sorted[half - 1], sorted[half])
    } else {
      throw new Error('empty arguments list')
    }
  }

  private static create(numerator: bigint, denominator: bigint): Rational {
    if (numerator) {
      if (denominator <= 0) {
        throw new Error('denominator <= 0')
      }
      const key = `${numerator}/${denominator}`
      let rational = Rational.getFromCache(key)
      if (!rational) {
        const gcd2 = gcd(numerator, denominator)
        const numerator2 = divide(numerator, gcd2)
        const denominator2 = divide(denominator, gcd2)
        rational = new Rational(numerator2, denominator2)
        Rational.addToCache(rational, key)
      }
      return rational
    } else {
      return Rational.ZERO
    }
  }

  @selfReplacing
  public get number(): number {
    const significantExponent = 20
    const division = divide(
      e(this.numerator, significantExponent),
      this.denominator
    )
    return Number(`${division}e-${significantExponent}`)
  }

  @selfReplacing
  public get string(): string {
    return `${this.numerator}${
      this.denominator === BigInt(1) ? '' : '/' + this.denominator
    }`
  }

  public [Symbol.toPrimitive](hint: string): string | number {
    if (hint === 'number') {
      console.error('no', hint)
      console.error(`do not use toPrimitive${new Error().stack}`)
    }
    return hint === 'number' ? this.number : this.string
  }

  @selfReplacing
  public get json(): RationalJson {
    return `${this.numerator}/${this.denominator}`
  }

  public add(rational: Rational): Rational {
    let a: bigint = this.numerator * rational.denominator
    let b: bigint = rational.numerator * this.denominator
    return Rational.create(a + b, this.denominator * rational.denominator)
  }

  public sub(rational: Rational): Rational {
    return this.add(rational.negated)
  }

  public mul(rational: Rational): Rational {
    return Rational.create(
      this.numerator * rational.numerator,
      this.denominator * rational.denominator
    )
  }

  public div(rational: Rational): Rational {
    return this.mul(rational.inverted)
  }

  @selfReplacing
  public get negative(): boolean {
    return this.numerator < 0
  }

  @selfReplacing
  public get negated(): Rational {
    return Rational.create(-this.numerator, this.denominator)
  }

  @selfReplacing
  public get abs(): Rational {
    return this.negative ? this.negated : this
  }

  @selfReplacing
  public get inverted(): Rational {
    return Rational.create(
      this.negative ? -this.denominator : this.denominator,
      abs(this.numerator)
    )
  }

  public cmp(rational: Rational): -1 | 0 | 1 {
    if (this.negative === rational.negative) {
      const a: bigint = this.numerator * rational.denominator
      const b: bigint = rational.numerator * this.denominator
      return a < b ? -1 : a > b ? 1 : 0
    }
    return this.negative ? -1 : 1
  }

  public eq(rational: Rational): boolean {
    return !this.cmp(rational)
  }

  public ne(rational: Rational): boolean {
    return !!this.cmp(rational)
  }

  public lt(rational: Rational): boolean {
    return this.cmp(rational) === -1
  }

  public le(rational: Rational): boolean {
    return this.cmp(rational) !== 1
  }

  public gt(rational: Rational): boolean {
    return this.cmp(rational) === 1
  }

  public ge(rational: Rational): boolean {
    return this.cmp(rational) !== -1
  }

  public roundByRational(
    rational: Rational,
    method: RoundMethod = 'toZero'
  ): Rational {
    const division = this.div(rational)
    const numerator2 = divide(division.numerator, division.denominator, method)
    return Rational.create(
      rational.numerator * numerator2,
      rational.denominator
    )
  }

  public roundToDecimal(
    decimal: number,
    method: RoundMethod = 'toZero'
  ): Decimal {
    const numerator = e(this.numerator, decimal > 0 ? decimal : 0)
    const denominator = e(this.denominator, decimal < 0 ? -decimal : 0)
    let numerator2: bigint = divide(numerator, denominator, method)
    return Decimal.fromBigInt(numerator2, -decimal)
  }

  public roundToSignificants(
    significantsLength: number,
    method: RoundMethod = 'toZero'
  ): Decimal {
    if (this === Rational.ZERO) {
      return Decimal.ZERO
    }
    const denominatorLength = this.denominator.toString().length
    const extension = significantsLength + denominatorLength
    const extendedNumerator: bigint = e(this.numerator, extension)
    const div = divide(extendedNumerator, this.denominator, method)
    const divLength = div.toString().length - Number(div < 0)
    const digitsSurplus = divLength - significantsLength
    let significants: bigint = e(div, -digitsSurplus, method)
    const exponent = digitsSurplus - extension
    return Decimal.fromBigInt(significants, exponent)
  }
}

Object.defineProperty(Rational.ZERO, 'inverted', {
  get: () => {
    throw new Error('inversion of zero')
  }
})

export const R = (s: number | Decimal): Rational => {
  if (typeof s !== 'number' && !(s instanceof Decimal)) {
    throw new Error(`wrong type ${s}`)
  }
  if (typeof s === 'number') {
    return Rational.fromNumber(s)
  } else {
    return Rational.fromDecimal(s)
  }
}
