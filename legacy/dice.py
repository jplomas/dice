# =============================================================================
# DEPRECATED — DO NOT USE TO GENERATE A WALLET YOU INTEND TO FUND.
#
# This is the original 2018 generator, kept for historical reference only.
# Use https://dice.theqrl.org instead.
#
# Known defects in this script:
#
#   1. Under-collects entropy when bits-per-roll does not divide 12.
#      `rolls_per_word = BITS/self.bits_per_roll` relies on Python 2
#      truncating division. For a 32-sided die this yields 2 instead of 2.4,
#      so each word is built from 10 bits rather than 12. The result carries
#      320 bits instead of 384, and word indices are confined to [0, 1023] —
#      a quarter of the wordlist. (320 bits is still far beyond brute force,
#      but it is not what this script claims to produce.)
#
#   2. Silently excludes word index 0. `if w == False` is true when w == 0
#      under Python 2, so a legitimate all-ones roll sequence is treated as
#      user error and re-rolled. The word `aback` can never appear.
#
#   3. Python 2 only. Uses `print` statements and `raw_input`, and
#      `tree_height` calls `bin(height/2)`, which raises TypeError on
#      Python 3. Python 2 reached end of life in January 2020.
#
# The current implementation fixes all three; see src/lib/dice.js and the
# comparison table in README.md.
# =============================================================================

# dice roll entropy functions to create a qrl mnemonic, ideally using a polyhedral dice..

import words    #qrl mnemonic words for lookup

# address descriptor constants
# https://docs.theqrl.org/developers/address/

# standard QRL mnemonic extended seed has 34 words of 12 bits data each (4096 word list)
# first 3 bytes (two 12 bit words) are the extended seed - this is the 24 bit address descriptor
# the nibbles of each of the three bytes in this descriptor are reversed..
# next 48 bytes are random data - in this case obtained through dice rolls 

# 3 byte address/seed descriptor

# bits 0-3 = HASH_FUNCTION

SHA2_256 = "0000"
SHAKE_128 = "0001"
SHAKE_256 = "0010"

HASH_FUNCTION = [SHA2_256, SHAKE_128, SHAKE_256]

#bits 4-7 = SIG_TYPE ..always XMSS
XMSS = "0000"
SIG_TYPE = XMSS

#bits 8-11 = PARAMETERS (tree height represented as height / 2 )

def bpad(h):                    #pad it up to 0b0000
    missing = 6-len(h)
    z = []
    for x in range(missing):
        z.append("0")     
    return h[:2] + "".join(z) + h[2:]

def tree_height(height):
    return bpad(bin(height/2))[2:]

#bits 12-15 ADDRESS_FORMAT ..always SHA256_2X
SHA256_2X = "0000"
ADDRESS_FORMAT = SHA256_2X

#bits 16-23 PARAMETERS 2 (reserved for future use..so 0)
PARAMETERS_TWO = "00000000"

#mnemonic has 32 words of random data
WORDCOUNT = 32
BITS = 12

# sided dice doesnt count 0, but we must. therefore binary range is 0-(x-1), dice is 1-x
def sides_to_bin(sides):
    sides -= 1
    if len(bin(sides+1)[2:]) == len(bin(sides)[2:]):
        return len(bin(sides)[2:])-1
    return len(bin(sides)[2:])


class Mnemonic():

    def __init__(self, treeheight=tree_height(10), sides=100, hashfunction=HASH_FUNCTION[1]):
        self.hashfunction = hashfunction
        self.word1 = words.words[int('0b' + SIG_TYPE + hashfunction + ADDRESS_FORMAT, 2)]
        self.word2 = words.words[int('0b' + treeheight + PARAMETERS_TWO, 2)]
        self.sides = sides
        self.words = WORDCOUNT
        self.bits = BITS
        self.seed_bits = BITS*WORDCOUNT
        self.bits_per_roll = sides_to_bin(sides)
        self.range = 2**self.bits_per_roll
        self.rolls_per_word = BITS/self.bits_per_roll
        self.rolls_per_mnemonic = self.rolls_per_word*WORDCOUNT
        self.mnemonic = []
        return

    def rolls_to_int(self):
        rolls = []
        print 'Number of rolls: ', self.rolls_per_word
        for x in range (self.rolls_per_word):
            print 'Roll: ' ,x+1, '  Enter dice value (1 - ', self.range, '): '
            roll = int(raw_input())
            if roll < 1 or roll > self.range:
                print 'Error, roll outside acceptable range (1 - ', self.range, ' )'
                return False
            rolls.append(roll-1)
        word = self.r_to_int(rolls)
        return word

    def r_to_int(self, rolls):
        word = ''
        if type(rolls) != list:
            return False
        rolls.reverse()
        for r in rolls:
            word = word + bin(r)[2:].zfill(self.bits_per_roll)
        return int(word, 2)

    def int_to_word(self, intw):
        return words.words[intw]

    def rolls_to_word(self):
        return self.int_to_word(self.rolls_to_int())

    def rolls_to_mnemonic(self):
        mnemonic = [self.word1,self.word2]
        print 'Prepare to roll your', self.sides, 'sided dice ', self.rolls_per_mnemonic, ' times, to create a ', self.words, ' mnemonic phrase..'
        for x in range(self.words):
            print 'Word number ', x+1, ' of ', self.words, ':'
            w = self.rolls_to_int()
            if w == False:                      # give one chance per word to user error
                w = self.rolls_to_int()
            if w == False:
                print 'Error, you must follow rules to create mnemonic correctly, please run script again.'
                return
            mnemonic.append(self.int_to_word(w))
        self.mnemonic = mnemonic
        return ' '.join(self.mnemonic)


#generate a qrl mnemonic using a dice

def gen_mnemonic():
    print 'Enter hash function ("0" SHA2_256, "1" SHAKE_128, "2" SHAKE_256)'
    hashf = HASH_FUNCTION[int(raw_input())]
    print 'Enter XMSS tree height ("10"=1024 signatures, "12"=4096, "14"=16384, "16"=65536, etc):'
    th=tree_height(int(raw_input()))
    print 'Enter the number of sides of the dice:'
    m = Mnemonic(sides=int(raw_input()), hashfunction=hashf,treeheight=th)
    print 'QRL mnemonic phrase: ' + m.rolls_to_mnemonic()

if __name__ == '__main__':
    print 'QRL mnemonic phrase dice generator...'
    gen_mnemonic()