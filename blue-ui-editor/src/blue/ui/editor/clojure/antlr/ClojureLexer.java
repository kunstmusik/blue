// $ANTLR 3.4 grammar/Clojure.g 2013-01-21 18:43:35
package blue.ui.editor.clojure.antlr;
import org.antlr.runtime.*;

@SuppressWarnings({"all", "warnings", "unchecked"})
public class ClojureLexer extends Lexer {
    public static final int EOF=-1;
    public static final int AMPERSAND=4;
    public static final int APOSTROPHE=5;
    public static final int BACKSLASH=6;
    public static final int BOOLEAN=7;
    public static final int CHARACTER=8;
    public static final int CIRCUMFLEX=9;
    public static final int CLOSE_PAREN=10;
    public static final int COMMENT=11;
    public static final int COMMERCIAL_AT=12;
    public static final int EscapeSequence=13;
    public static final int HEXDIGIT=14;
    public static final int KEYWORD=15;
    public static final int LAMBDA_ARG=16;
    public static final int LEFT_CURLY_BRACKET=17;
    public static final int LEFT_SQUARE_BRACKET=18;
    public static final int METADATA_TYPEHINT=19;
    public static final int NAME=20;
    public static final int NIL=21;
    public static final int NUMBER=22;
    public static final int NUMBER_SIGN=23;
    public static final int OPEN_PAREN=24;
    public static final int OctalEscape=25;
    public static final int REGEX_LITERAL=26;
    public static final int RIGHT_CURLY_BRACKET=27;
    public static final int RIGHT_SQUARE_BRACKET=28;
    public static final int SPACE=29;
    public static final int SPECIAL_FORM=30;
    public static final int STRING=31;
    public static final int SYMBOL=32;
    public static final int SYMBOL_HEAD=33;
    public static final int SYMBOL_REST=34;
    public static final int SYNTAX_QUOTE=35;
    public static final int UNQUOTE=36;
    public static final int UNQUOTE_SPLICING=37;
    public static final int UnicodeEscape=38;

    // delegates
    // delegators
    public Lexer[] getDelegates() {
        return new Lexer[] {};
    }

    public ClojureLexer() {} 
    public ClojureLexer(CharStream input) {
        this(input, new RecognizerSharedState());
    }
    public ClojureLexer(CharStream input, RecognizerSharedState state) {
        super(input,state);
    }
    public String getGrammarFileName() { return "grammar/Clojure.g"; }

    // $ANTLR start "OPEN_PAREN"
    public final void mOPEN_PAREN() throws RecognitionException {
        try {
            int _type = OPEN_PAREN;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:42:11: ( '(' )
            // grammar/Clojure.g:42:13: '('
            {
            match('('); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "OPEN_PAREN"

    // $ANTLR start "CLOSE_PAREN"
    public final void mCLOSE_PAREN() throws RecognitionException {
        try {
            int _type = CLOSE_PAREN;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:44:12: ( ')' )
            // grammar/Clojure.g:44:14: ')'
            {
            match(')'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "CLOSE_PAREN"

    // $ANTLR start "AMPERSAND"
    public final void mAMPERSAND() throws RecognitionException {
        try {
            int _type = AMPERSAND;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:46:10: ( '&' )
            // grammar/Clojure.g:46:12: '&'
            {
            match('&'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "AMPERSAND"

    // $ANTLR start "LEFT_SQUARE_BRACKET"
    public final void mLEFT_SQUARE_BRACKET() throws RecognitionException {
        try {
            int _type = LEFT_SQUARE_BRACKET;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:48:20: ( '[' )
            // grammar/Clojure.g:48:22: '['
            {
            match('['); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "LEFT_SQUARE_BRACKET"

    // $ANTLR start "RIGHT_SQUARE_BRACKET"
    public final void mRIGHT_SQUARE_BRACKET() throws RecognitionException {
        try {
            int _type = RIGHT_SQUARE_BRACKET;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:50:21: ( ']' )
            // grammar/Clojure.g:50:23: ']'
            {
            match(']'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "RIGHT_SQUARE_BRACKET"

    // $ANTLR start "LEFT_CURLY_BRACKET"
    public final void mLEFT_CURLY_BRACKET() throws RecognitionException {
        try {
            int _type = LEFT_CURLY_BRACKET;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:52:19: ( '{' )
            // grammar/Clojure.g:52:21: '{'
            {
            match('{'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "LEFT_CURLY_BRACKET"

    // $ANTLR start "RIGHT_CURLY_BRACKET"
    public final void mRIGHT_CURLY_BRACKET() throws RecognitionException {
        try {
            int _type = RIGHT_CURLY_BRACKET;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:54:20: ( '}' )
            // grammar/Clojure.g:54:22: '}'
            {
            match('}'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "RIGHT_CURLY_BRACKET"

    // $ANTLR start "BACKSLASH"
    public final void mBACKSLASH() throws RecognitionException {
        try {
            int _type = BACKSLASH;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:56:10: ( '\\\\' )
            // grammar/Clojure.g:56:12: '\\\\'
            {
            match('\\'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "BACKSLASH"

    // $ANTLR start "CIRCUMFLEX"
    public final void mCIRCUMFLEX() throws RecognitionException {
        try {
            int _type = CIRCUMFLEX;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:58:11: ( '^' )
            // grammar/Clojure.g:58:13: '^'
            {
            match('^'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "CIRCUMFLEX"

    // $ANTLR start "COMMERCIAL_AT"
    public final void mCOMMERCIAL_AT() throws RecognitionException {
        try {
            int _type = COMMERCIAL_AT;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:60:14: ( '@' )
            // grammar/Clojure.g:60:16: '@'
            {
            match('@'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "COMMERCIAL_AT"

    // $ANTLR start "NUMBER_SIGN"
    public final void mNUMBER_SIGN() throws RecognitionException {
        try {
            int _type = NUMBER_SIGN;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:62:12: ( '#' )
            // grammar/Clojure.g:62:14: '#'
            {
            match('#'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "NUMBER_SIGN"

    // $ANTLR start "APOSTROPHE"
    public final void mAPOSTROPHE() throws RecognitionException {
        try {
            int _type = APOSTROPHE;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:64:11: ( '\\'' )
            // grammar/Clojure.g:64:13: '\\''
            {
            match('\''); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "APOSTROPHE"

    // $ANTLR start "SPECIAL_FORM"
    public final void mSPECIAL_FORM() throws RecognitionException {
        try {
            int _type = SPECIAL_FORM;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:68:13: ( 'def' | 'if' | 'do' | 'let' | 'quote' | 'var' | 'fn' | 'loop' | 'recur' | 'throw' | 'try' | 'monitor-enter' | 'monitor-exit' | 'new' | 'set!' | '.' )
            int alt1=16;
            switch ( input.LA(1) ) {
            case 'd':
                {
                int LA1_1 = input.LA(2);

                if ( (LA1_1=='e') ) {
                    alt1=1;
                }
                else if ( (LA1_1=='o') ) {
                    alt1=3;
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 1, 1, input);

                    throw nvae;

                }
                }
                break;
            case 'i':
                {
                alt1=2;
                }
                break;
            case 'l':
                {
                int LA1_3 = input.LA(2);

                if ( (LA1_3=='e') ) {
                    alt1=4;
                }
                else if ( (LA1_3=='o') ) {
                    alt1=8;
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 1, 3, input);

                    throw nvae;

                }
                }
                break;
            case 'q':
                {
                alt1=5;
                }
                break;
            case 'v':
                {
                alt1=6;
                }
                break;
            case 'f':
                {
                alt1=7;
                }
                break;
            case 'r':
                {
                alt1=9;
                }
                break;
            case 't':
                {
                int LA1_8 = input.LA(2);

                if ( (LA1_8=='h') ) {
                    alt1=10;
                }
                else if ( (LA1_8=='r') ) {
                    alt1=11;
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 1, 8, input);

                    throw nvae;

                }
                }
                break;
            case 'm':
                {
                int LA1_9 = input.LA(2);

                if ( (LA1_9=='o') ) {
                    int LA1_19 = input.LA(3);

                    if ( (LA1_19=='n') ) {
                        int LA1_20 = input.LA(4);

                        if ( (LA1_20=='i') ) {
                            int LA1_21 = input.LA(5);

                            if ( (LA1_21=='t') ) {
                                int LA1_22 = input.LA(6);

                                if ( (LA1_22=='o') ) {
                                    int LA1_23 = input.LA(7);

                                    if ( (LA1_23=='r') ) {
                                        int LA1_24 = input.LA(8);

                                        if ( (LA1_24=='-') ) {
                                            int LA1_25 = input.LA(9);

                                            if ( (LA1_25=='e') ) {
                                                int LA1_26 = input.LA(10);

                                                if ( (LA1_26=='n') ) {
                                                    alt1=12;
                                                }
                                                else if ( (LA1_26=='x') ) {
                                                    alt1=13;
                                                }
                                                else {
                                                    NoViableAltException nvae =
                                                        new NoViableAltException("", 1, 26, input);

                                                    throw nvae;

                                                }
                                            }
                                            else {
                                                NoViableAltException nvae =
                                                    new NoViableAltException("", 1, 25, input);

                                                throw nvae;

                                            }
                                        }
                                        else {
                                            NoViableAltException nvae =
                                                new NoViableAltException("", 1, 24, input);

                                            throw nvae;

                                        }
                                    }
                                    else {
                                        NoViableAltException nvae =
                                            new NoViableAltException("", 1, 23, input);

                                        throw nvae;

                                    }
                                }
                                else {
                                    NoViableAltException nvae =
                                        new NoViableAltException("", 1, 22, input);

                                    throw nvae;

                                }
                            }
                            else {
                                NoViableAltException nvae =
                                    new NoViableAltException("", 1, 21, input);

                                throw nvae;

                            }
                        }
                        else {
                            NoViableAltException nvae =
                                new NoViableAltException("", 1, 20, input);

                            throw nvae;

                        }
                    }
                    else {
                        NoViableAltException nvae =
                            new NoViableAltException("", 1, 19, input);

                        throw nvae;

                    }
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 1, 9, input);

                    throw nvae;

                }
                }
                break;
            case 'n':
                {
                alt1=14;
                }
                break;
            case 's':
                {
                alt1=15;
                }
                break;
            case '.':
                {
                alt1=16;
                }
                break;
            default:
                NoViableAltException nvae =
                    new NoViableAltException("", 1, 0, input);

                throw nvae;

            }

            switch (alt1) {
                case 1 :
                    // grammar/Clojure.g:68:15: 'def'
                    {
                    match("def"); 



                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:68:23: 'if'
                    {
                    match("if"); 



                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:68:30: 'do'
                    {
                    match("do"); 



                    }
                    break;
                case 4 :
                    // grammar/Clojure.g:68:37: 'let'
                    {
                    match("let"); 



                    }
                    break;
                case 5 :
                    // grammar/Clojure.g:68:45: 'quote'
                    {
                    match("quote"); 



                    }
                    break;
                case 6 :
                    // grammar/Clojure.g:68:55: 'var'
                    {
                    match("var"); 



                    }
                    break;
                case 7 :
                    // grammar/Clojure.g:68:63: 'fn'
                    {
                    match("fn"); 



                    }
                    break;
                case 8 :
                    // grammar/Clojure.g:68:70: 'loop'
                    {
                    match("loop"); 



                    }
                    break;
                case 9 :
                    // grammar/Clojure.g:69:13: 'recur'
                    {
                    match("recur"); 



                    }
                    break;
                case 10 :
                    // grammar/Clojure.g:69:23: 'throw'
                    {
                    match("throw"); 



                    }
                    break;
                case 11 :
                    // grammar/Clojure.g:69:33: 'try'
                    {
                    match("try"); 



                    }
                    break;
                case 12 :
                    // grammar/Clojure.g:69:41: 'monitor-enter'
                    {
                    match("monitor-enter"); 



                    }
                    break;
                case 13 :
                    // grammar/Clojure.g:69:59: 'monitor-exit'
                    {
                    match("monitor-exit"); 



                    }
                    break;
                case 14 :
                    // grammar/Clojure.g:70:13: 'new'
                    {
                    match("new"); 



                    }
                    break;
                case 15 :
                    // grammar/Clojure.g:70:21: 'set!'
                    {
                    match("set!"); 



                    }
                    break;
                case 16 :
                    // grammar/Clojure.g:70:30: '.'
                    {
                    match('.'); 

                    }
                    break;

            }
            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SPECIAL_FORM"

    // $ANTLR start "STRING"
    public final void mSTRING() throws RecognitionException {
        try {
            int _type = STRING;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:75:5: ( '\"' ( EscapeSequence |~ ( '\\\\' | '\"' ) )* '\"' )
            // grammar/Clojure.g:75:8: '\"' ( EscapeSequence |~ ( '\\\\' | '\"' ) )* '\"'
            {
            match('\"'); 

            // grammar/Clojure.g:75:12: ( EscapeSequence |~ ( '\\\\' | '\"' ) )*
            loop2:
            do {
                int alt2=3;
                int LA2_0 = input.LA(1);

                if ( (LA2_0=='\\') ) {
                    alt2=1;
                }
                else if ( ((LA2_0 >= '\u0000' && LA2_0 <= '!')||(LA2_0 >= '#' && LA2_0 <= '[')||(LA2_0 >= ']' && LA2_0 <= '\uFFFF')) ) {
                    alt2=2;
                }


                switch (alt2) {
            	case 1 :
            	    // grammar/Clojure.g:75:14: EscapeSequence
            	    {
            	    mEscapeSequence(); 


            	    }
            	    break;
            	case 2 :
            	    // grammar/Clojure.g:75:31: ~ ( '\\\\' | '\"' )
            	    {
            	    if ( (input.LA(1) >= '\u0000' && input.LA(1) <= '!')||(input.LA(1) >= '#' && input.LA(1) <= '[')||(input.LA(1) >= ']' && input.LA(1) <= '\uFFFF') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    break loop2;
                }
            } while (true);


            match('\"'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "STRING"

    // $ANTLR start "REGEX_LITERAL"
    public final void mREGEX_LITERAL() throws RecognitionException {
        try {
            int _type = REGEX_LITERAL;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:79:5: ( NUMBER_SIGN '\"' (~ ( '\\\\' | '\"' ) | '\\\\' . )* '\"' )
            // grammar/Clojure.g:79:7: NUMBER_SIGN '\"' (~ ( '\\\\' | '\"' ) | '\\\\' . )* '\"'
            {
            mNUMBER_SIGN(); 


            match('\"'); 

            // grammar/Clojure.g:79:23: (~ ( '\\\\' | '\"' ) | '\\\\' . )*
            loop3:
            do {
                int alt3=3;
                int LA3_0 = input.LA(1);

                if ( ((LA3_0 >= '\u0000' && LA3_0 <= '!')||(LA3_0 >= '#' && LA3_0 <= '[')||(LA3_0 >= ']' && LA3_0 <= '\uFFFF')) ) {
                    alt3=1;
                }
                else if ( (LA3_0=='\\') ) {
                    alt3=2;
                }


                switch (alt3) {
            	case 1 :
            	    // grammar/Clojure.g:79:25: ~ ( '\\\\' | '\"' )
            	    {
            	    if ( (input.LA(1) >= '\u0000' && input.LA(1) <= '!')||(input.LA(1) >= '#' && input.LA(1) <= '[')||(input.LA(1) >= ']' && input.LA(1) <= '\uFFFF') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;
            	case 2 :
            	    // grammar/Clojure.g:79:41: '\\\\' .
            	    {
            	    match('\\'); 

            	    matchAny(); 

            	    }
            	    break;

            	default :
            	    break loop3;
                }
            } while (true);


            match('\"'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "REGEX_LITERAL"

    // $ANTLR start "EscapeSequence"
    public final void mEscapeSequence() throws RecognitionException {
        try {
            // grammar/Clojure.g:86:7: ( '\\\\' . )
            // grammar/Clojure.g:86:11: '\\\\' .
            {
            match('\\'); 

            matchAny(); 

            }


        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "EscapeSequence"

    // $ANTLR start "UnicodeEscape"
    public final void mUnicodeEscape() throws RecognitionException {
        try {
            // grammar/Clojure.g:95:5: ( '\\\\' 'u' HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT )
            // grammar/Clojure.g:95:9: '\\\\' 'u' HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT
            {
            match('\\'); 

            match('u'); 

            mHEXDIGIT(); 


            mHEXDIGIT(); 


            mHEXDIGIT(); 


            mHEXDIGIT(); 


            }


        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "UnicodeEscape"

    // $ANTLR start "OctalEscape"
    public final void mOctalEscape() throws RecognitionException {
        try {
            // grammar/Clojure.g:101:5: ( '\\\\' ( '0' .. '3' ) ( '0' .. '7' ) ( '0' .. '7' ) | '\\\\' ( '0' .. '7' ) ( '0' .. '7' ) | '\\\\' ( '0' .. '7' ) )
            int alt4=3;
            int LA4_0 = input.LA(1);

            if ( (LA4_0=='\\') ) {
                int LA4_1 = input.LA(2);

                if ( ((LA4_1 >= '0' && LA4_1 <= '3')) ) {
                    int LA4_2 = input.LA(3);

                    if ( ((LA4_2 >= '0' && LA4_2 <= '7')) ) {
                        int LA4_4 = input.LA(4);

                        if ( ((LA4_4 >= '0' && LA4_4 <= '7')) ) {
                            alt4=1;
                        }
                        else {
                            alt4=2;
                        }
                    }
                    else {
                        alt4=3;
                    }
                }
                else if ( ((LA4_1 >= '4' && LA4_1 <= '7')) ) {
                    int LA4_3 = input.LA(3);

                    if ( ((LA4_3 >= '0' && LA4_3 <= '7')) ) {
                        alt4=2;
                    }
                    else {
                        alt4=3;
                    }
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 4, 1, input);

                    throw nvae;

                }
            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 4, 0, input);

                throw nvae;

            }
            switch (alt4) {
                case 1 :
                    // grammar/Clojure.g:101:9: '\\\\' ( '0' .. '3' ) ( '0' .. '7' ) ( '0' .. '7' )
                    {
                    match('\\'); 

                    if ( (input.LA(1) >= '0' && input.LA(1) <= '3') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    if ( (input.LA(1) >= '0' && input.LA(1) <= '7') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    if ( (input.LA(1) >= '0' && input.LA(1) <= '7') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:102:9: '\\\\' ( '0' .. '7' ) ( '0' .. '7' )
                    {
                    match('\\'); 

                    if ( (input.LA(1) >= '0' && input.LA(1) <= '7') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    if ( (input.LA(1) >= '0' && input.LA(1) <= '7') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:103:9: '\\\\' ( '0' .. '7' )
                    {
                    match('\\'); 

                    if ( (input.LA(1) >= '0' && input.LA(1) <= '7') ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    }
                    break;

            }

        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "OctalEscape"

    // $ANTLR start "NUMBER"
    public final void mNUMBER() throws RecognitionException {
        try {
            int _type = NUMBER;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:107:7: ( ( '-' )? ( '0' .. '9' )+ ( '.' ( '0' .. '9' )+ )? ( ( 'e' | 'E' ) ( '-' )? ( '0' .. '9' )+ )? )
            // grammar/Clojure.g:107:9: ( '-' )? ( '0' .. '9' )+ ( '.' ( '0' .. '9' )+ )? ( ( 'e' | 'E' ) ( '-' )? ( '0' .. '9' )+ )?
            {
            // grammar/Clojure.g:107:9: ( '-' )?
            int alt5=2;
            int LA5_0 = input.LA(1);

            if ( (LA5_0=='-') ) {
                alt5=1;
            }
            switch (alt5) {
                case 1 :
                    // grammar/Clojure.g:107:9: '-'
                    {
                    match('-'); 

                    }
                    break;

            }


            // grammar/Clojure.g:107:14: ( '0' .. '9' )+
            int cnt6=0;
            loop6:
            do {
                int alt6=2;
                int LA6_0 = input.LA(1);

                if ( ((LA6_0 >= '0' && LA6_0 <= '9')) ) {
                    alt6=1;
                }


                switch (alt6) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( (input.LA(1) >= '0' && input.LA(1) <= '9') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    if ( cnt6 >= 1 ) break loop6;
                        EarlyExitException eee =
                            new EarlyExitException(6, input);
                        throw eee;
                }
                cnt6++;
            } while (true);


            // grammar/Clojure.g:107:24: ( '.' ( '0' .. '9' )+ )?
            int alt8=2;
            int LA8_0 = input.LA(1);

            if ( (LA8_0=='.') ) {
                alt8=1;
            }
            switch (alt8) {
                case 1 :
                    // grammar/Clojure.g:107:25: '.' ( '0' .. '9' )+
                    {
                    match('.'); 

                    // grammar/Clojure.g:107:29: ( '0' .. '9' )+
                    int cnt7=0;
                    loop7:
                    do {
                        int alt7=2;
                        int LA7_0 = input.LA(1);

                        if ( ((LA7_0 >= '0' && LA7_0 <= '9')) ) {
                            alt7=1;
                        }


                        switch (alt7) {
                    	case 1 :
                    	    // grammar/Clojure.g:
                    	    {
                    	    if ( (input.LA(1) >= '0' && input.LA(1) <= '9') ) {
                    	        input.consume();
                    	    }
                    	    else {
                    	        MismatchedSetException mse = new MismatchedSetException(null,input);
                    	        recover(mse);
                    	        throw mse;
                    	    }


                    	    }
                    	    break;

                    	default :
                    	    if ( cnt7 >= 1 ) break loop7;
                                EarlyExitException eee =
                                    new EarlyExitException(7, input);
                                throw eee;
                        }
                        cnt7++;
                    } while (true);


                    }
                    break;

            }


            // grammar/Clojure.g:107:41: ( ( 'e' | 'E' ) ( '-' )? ( '0' .. '9' )+ )?
            int alt11=2;
            int LA11_0 = input.LA(1);

            if ( (LA11_0=='E'||LA11_0=='e') ) {
                alt11=1;
            }
            switch (alt11) {
                case 1 :
                    // grammar/Clojure.g:107:42: ( 'e' | 'E' ) ( '-' )? ( '0' .. '9' )+
                    {
                    if ( input.LA(1)=='E'||input.LA(1)=='e' ) {
                        input.consume();
                    }
                    else {
                        MismatchedSetException mse = new MismatchedSetException(null,input);
                        recover(mse);
                        throw mse;
                    }


                    // grammar/Clojure.g:107:52: ( '-' )?
                    int alt9=2;
                    int LA9_0 = input.LA(1);

                    if ( (LA9_0=='-') ) {
                        alt9=1;
                    }
                    switch (alt9) {
                        case 1 :
                            // grammar/Clojure.g:107:52: '-'
                            {
                            match('-'); 

                            }
                            break;

                    }


                    // grammar/Clojure.g:107:57: ( '0' .. '9' )+
                    int cnt10=0;
                    loop10:
                    do {
                        int alt10=2;
                        int LA10_0 = input.LA(1);

                        if ( ((LA10_0 >= '0' && LA10_0 <= '9')) ) {
                            alt10=1;
                        }


                        switch (alt10) {
                    	case 1 :
                    	    // grammar/Clojure.g:
                    	    {
                    	    if ( (input.LA(1) >= '0' && input.LA(1) <= '9') ) {
                    	        input.consume();
                    	    }
                    	    else {
                    	        MismatchedSetException mse = new MismatchedSetException(null,input);
                    	        recover(mse);
                    	        throw mse;
                    	    }


                    	    }
                    	    break;

                    	default :
                    	    if ( cnt10 >= 1 ) break loop10;
                                EarlyExitException eee =
                                    new EarlyExitException(10, input);
                                throw eee;
                        }
                        cnt10++;
                    } while (true);


                    }
                    break;

            }


            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "NUMBER"

    // $ANTLR start "CHARACTER"
    public final void mCHARACTER() throws RecognitionException {
        try {
            int _type = CHARACTER;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:110:10: ( '\\\\newline' | '\\\\space' | '\\\\tab' | '\\\\u' HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT | BACKSLASH . )
            int alt12=5;
            int LA12_0 = input.LA(1);

            if ( (LA12_0=='\\') ) {
                int LA12_1 = input.LA(2);

                if ( (LA12_1=='n') ) {
                    int LA12_2 = input.LA(3);

                    if ( (LA12_2=='e') ) {
                        alt12=1;
                    }
                    else {
                        alt12=5;
                    }
                }
                else if ( (LA12_1=='s') ) {
                    int LA12_3 = input.LA(3);

                    if ( (LA12_3=='p') ) {
                        alt12=2;
                    }
                    else {
                        alt12=5;
                    }
                }
                else if ( (LA12_1=='t') ) {
                    int LA12_4 = input.LA(3);

                    if ( (LA12_4=='a') ) {
                        alt12=3;
                    }
                    else {
                        alt12=5;
                    }
                }
                else if ( (LA12_1=='u') ) {
                    int LA12_5 = input.LA(3);

                    if ( ((LA12_5 >= '0' && LA12_5 <= '9')||(LA12_5 >= 'A' && LA12_5 <= 'F')||(LA12_5 >= 'a' && LA12_5 <= 'f')) ) {
                        alt12=4;
                    }
                    else {
                        alt12=5;
                    }
                }
                else if ( ((LA12_1 >= '\u0000' && LA12_1 <= 'm')||(LA12_1 >= 'o' && LA12_1 <= 'r')||(LA12_1 >= 'v' && LA12_1 <= '\uFFFF')) ) {
                    alt12=5;
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 12, 1, input);

                    throw nvae;

                }
            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 12, 0, input);

                throw nvae;

            }
            switch (alt12) {
                case 1 :
                    // grammar/Clojure.g:111:9: '\\\\newline'
                    {
                    match("\\newline"); 



                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:112:9: '\\\\space'
                    {
                    match("\\space"); 



                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:113:9: '\\\\tab'
                    {
                    match("\\tab"); 



                    }
                    break;
                case 4 :
                    // grammar/Clojure.g:114:9: '\\\\u' HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT
                    {
                    match("\\u"); 



                    mHEXDIGIT(); 


                    mHEXDIGIT(); 


                    mHEXDIGIT(); 


                    mHEXDIGIT(); 


                    }
                    break;
                case 5 :
                    // grammar/Clojure.g:115:9: BACKSLASH .
                    {
                    mBACKSLASH(); 


                    matchAny(); 

                    }
                    break;

            }
            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "CHARACTER"

    // $ANTLR start "HEXDIGIT"
    public final void mHEXDIGIT() throws RecognitionException {
        try {
            int _type = HEXDIGIT;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:118:9: ( '0' .. '9' | 'a' .. 'f' | 'A' .. 'F' )
            // grammar/Clojure.g:
            {
            if ( (input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= 'A' && input.LA(1) <= 'F')||(input.LA(1) >= 'a' && input.LA(1) <= 'f') ) {
                input.consume();
            }
            else {
                MismatchedSetException mse = new MismatchedSetException(null,input);
                recover(mse);
                throw mse;
            }


            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "HEXDIGIT"

    // $ANTLR start "NIL"
    public final void mNIL() throws RecognitionException {
        try {
            int _type = NIL;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:121:4: ( 'nil' )
            // grammar/Clojure.g:121:9: 'nil'
            {
            match("nil"); 



            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "NIL"

    // $ANTLR start "BOOLEAN"
    public final void mBOOLEAN() throws RecognitionException {
        try {
            int _type = BOOLEAN;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:124:8: ( 'true' | 'false' )
            int alt13=2;
            int LA13_0 = input.LA(1);

            if ( (LA13_0=='t') ) {
                alt13=1;
            }
            else if ( (LA13_0=='f') ) {
                alt13=2;
            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 13, 0, input);

                throw nvae;

            }
            switch (alt13) {
                case 1 :
                    // grammar/Clojure.g:125:9: 'true'
                    {
                    match("true"); 



                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:126:9: 'false'
                    {
                    match("false"); 



                    }
                    break;

            }
            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "BOOLEAN"

    // $ANTLR start "SYMBOL"
    public final void mSYMBOL() throws RecognitionException {
        try {
            int _type = SYMBOL;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:129:7: ( '/' | NAME ( '/' NAME )? )
            int alt15=2;
            int LA15_0 = input.LA(1);

            if ( (LA15_0=='/') ) {
                alt15=1;
            }
            else if ( (LA15_0=='!'||LA15_0=='$'||(LA15_0 >= '*' && LA15_0 <= '+')||LA15_0=='-'||(LA15_0 >= '<' && LA15_0 <= '?')||(LA15_0 >= 'A' && LA15_0 <= 'Z')||LA15_0=='_'||(LA15_0 >= 'a' && LA15_0 <= 'z')) ) {
                alt15=2;
            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 15, 0, input);

                throw nvae;

            }
            switch (alt15) {
                case 1 :
                    // grammar/Clojure.g:130:9: '/'
                    {
                    match('/'); 

                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:131:9: NAME ( '/' NAME )?
                    {
                    mNAME(); 


                    // grammar/Clojure.g:131:14: ( '/' NAME )?
                    int alt14=2;
                    int LA14_0 = input.LA(1);

                    if ( (LA14_0=='/') ) {
                        alt14=1;
                    }
                    switch (alt14) {
                        case 1 :
                            // grammar/Clojure.g:131:15: '/' NAME
                            {
                            match('/'); 

                            mNAME(); 


                            }
                            break;

                    }


                    }
                    break;

            }
            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SYMBOL"

    // $ANTLR start "METADATA_TYPEHINT"
    public final void mMETADATA_TYPEHINT() throws RecognitionException {
        try {
            int _type = METADATA_TYPEHINT;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:134:18: ( ( NUMBER_SIGN )* CIRCUMFLEX ( 'ints' | 'floats' | 'longs' | 'doubles' | 'objects' | NAME | STRING )* )
            // grammar/Clojure.g:135:3: ( NUMBER_SIGN )* CIRCUMFLEX ( 'ints' | 'floats' | 'longs' | 'doubles' | 'objects' | NAME | STRING )*
            {
            // grammar/Clojure.g:135:3: ( NUMBER_SIGN )*
            loop16:
            do {
                int alt16=2;
                int LA16_0 = input.LA(1);

                if ( (LA16_0=='#') ) {
                    alt16=1;
                }


                switch (alt16) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( input.LA(1)=='#' ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    break loop16;
                }
            } while (true);


            mCIRCUMFLEX(); 


            // grammar/Clojure.g:135:27: ( 'ints' | 'floats' | 'longs' | 'doubles' | 'objects' | NAME | STRING )*
            loop17:
            do {
                int alt17=8;
                switch ( input.LA(1) ) {
                case 'i':
                    {
                    int LA17_2 = input.LA(2);

                    if ( (LA17_2=='n') ) {
                        int LA17_9 = input.LA(3);

                        if ( (LA17_9=='t') ) {
                            int LA17_14 = input.LA(4);

                            if ( (LA17_14=='s') ) {
                                alt17=1;
                            }

                            else {
                                alt17=6;
                            }


                        }

                        else {
                            alt17=6;
                        }


                    }

                    else {
                        alt17=6;
                    }


                    }
                    break;
                case 'f':
                    {
                    int LA17_3 = input.LA(2);

                    if ( (LA17_3=='l') ) {
                        int LA17_10 = input.LA(3);

                        if ( (LA17_10=='o') ) {
                            int LA17_15 = input.LA(4);

                            if ( (LA17_15=='a') ) {
                                int LA17_20 = input.LA(5);

                                if ( (LA17_20=='t') ) {
                                    int LA17_24 = input.LA(6);

                                    if ( (LA17_24=='s') ) {
                                        alt17=2;
                                    }

                                    else {
                                        alt17=6;
                                    }


                                }

                                else {
                                    alt17=6;
                                }


                            }

                            else {
                                alt17=6;
                            }


                        }

                        else {
                            alt17=6;
                        }


                    }

                    else {
                        alt17=6;
                    }


                    }
                    break;
                case 'l':
                    {
                    int LA17_4 = input.LA(2);

                    if ( (LA17_4=='o') ) {
                        int LA17_11 = input.LA(3);

                        if ( (LA17_11=='n') ) {
                            int LA17_16 = input.LA(4);

                            if ( (LA17_16=='g') ) {
                                int LA17_21 = input.LA(5);

                                if ( (LA17_21=='s') ) {
                                    alt17=3;
                                }

                                else {
                                    alt17=6;
                                }


                            }

                            else {
                                alt17=6;
                            }


                        }

                        else {
                            alt17=6;
                        }


                    }

                    else {
                        alt17=6;
                    }


                    }
                    break;
                case 'd':
                    {
                    int LA17_5 = input.LA(2);

                    if ( (LA17_5=='o') ) {
                        int LA17_12 = input.LA(3);

                        if ( (LA17_12=='u') ) {
                            int LA17_17 = input.LA(4);

                            if ( (LA17_17=='b') ) {
                                int LA17_22 = input.LA(5);

                                if ( (LA17_22=='l') ) {
                                    int LA17_26 = input.LA(6);

                                    if ( (LA17_26=='e') ) {
                                        int LA17_29 = input.LA(7);

                                        if ( (LA17_29=='s') ) {
                                            alt17=4;
                                        }

                                        else {
                                            alt17=6;
                                        }


                                    }

                                    else {
                                        alt17=6;
                                    }


                                }

                                else {
                                    alt17=6;
                                }


                            }

                            else {
                                alt17=6;
                            }


                        }

                        else {
                            alt17=6;
                        }


                    }

                    else {
                        alt17=6;
                    }


                    }
                    break;
                case 'o':
                    {
                    int LA17_6 = input.LA(2);

                    if ( (LA17_6=='b') ) {
                        int LA17_13 = input.LA(3);

                        if ( (LA17_13=='j') ) {
                            int LA17_18 = input.LA(4);

                            if ( (LA17_18=='e') ) {
                                int LA17_23 = input.LA(5);

                                if ( (LA17_23=='c') ) {
                                    int LA17_27 = input.LA(6);

                                    if ( (LA17_27=='t') ) {
                                        int LA17_30 = input.LA(7);

                                        if ( (LA17_30=='s') ) {
                                            alt17=5;
                                        }

                                        else {
                                            alt17=6;
                                        }


                                    }

                                    else {
                                        alt17=6;
                                    }


                                }

                                else {
                                    alt17=6;
                                }


                            }

                            else {
                                alt17=6;
                            }


                        }

                        else {
                            alt17=6;
                        }


                    }

                    else {
                        alt17=6;
                    }


                    }
                    break;
                case '!':
                case '$':
                case '*':
                case '+':
                case '-':
                case '<':
                case '=':
                case '>':
                case '?':
                case 'A':
                case 'B':
                case 'C':
                case 'D':
                case 'E':
                case 'F':
                case 'G':
                case 'H':
                case 'I':
                case 'J':
                case 'K':
                case 'L':
                case 'M':
                case 'N':
                case 'O':
                case 'P':
                case 'Q':
                case 'R':
                case 'S':
                case 'T':
                case 'U':
                case 'V':
                case 'W':
                case 'X':
                case 'Y':
                case 'Z':
                case '_':
                case 'a':
                case 'b':
                case 'c':
                case 'e':
                case 'g':
                case 'h':
                case 'j':
                case 'k':
                case 'm':
                case 'n':
                case 'p':
                case 'q':
                case 'r':
                case 's':
                case 't':
                case 'u':
                case 'v':
                case 'w':
                case 'x':
                case 'y':
                case 'z':
                    {
                    alt17=6;
                    }
                    break;
                case '\"':
                    {
                    alt17=7;
                    }
                    break;

                }

                switch (alt17) {
            	case 1 :
            	    // grammar/Clojure.g:135:29: 'ints'
            	    {
            	    match("ints"); 



            	    }
            	    break;
            	case 2 :
            	    // grammar/Clojure.g:135:38: 'floats'
            	    {
            	    match("floats"); 



            	    }
            	    break;
            	case 3 :
            	    // grammar/Clojure.g:135:49: 'longs'
            	    {
            	    match("longs"); 



            	    }
            	    break;
            	case 4 :
            	    // grammar/Clojure.g:135:59: 'doubles'
            	    {
            	    match("doubles"); 



            	    }
            	    break;
            	case 5 :
            	    // grammar/Clojure.g:135:71: 'objects'
            	    {
            	    match("objects"); 



            	    }
            	    break;
            	case 6 :
            	    // grammar/Clojure.g:135:83: NAME
            	    {
            	    mNAME(); 


            	    }
            	    break;
            	case 7 :
            	    // grammar/Clojure.g:135:90: STRING
            	    {
            	    mSTRING(); 


            	    }
            	    break;

            	default :
            	    break loop17;
                }
            } while (true);


            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "METADATA_TYPEHINT"

    // $ANTLR start "NAME"
    public final void mNAME() throws RecognitionException {
        try {
            // grammar/Clojure.g:140:5: ( SYMBOL_HEAD ( SYMBOL_REST )* ( ':' ( SYMBOL_REST )+ )* )
            // grammar/Clojure.g:140:9: SYMBOL_HEAD ( SYMBOL_REST )* ( ':' ( SYMBOL_REST )+ )*
            {
            mSYMBOL_HEAD(); 


            // grammar/Clojure.g:140:21: ( SYMBOL_REST )*
            loop18:
            do {
                int alt18=2;
                int LA18_0 = input.LA(1);

                if ( (LA18_0=='!'||(LA18_0 >= '#' && LA18_0 <= '$')||(LA18_0 >= '*' && LA18_0 <= '+')||(LA18_0 >= '-' && LA18_0 <= '.')||(LA18_0 >= '0' && LA18_0 <= '9')||(LA18_0 >= '<' && LA18_0 <= '?')||(LA18_0 >= 'A' && LA18_0 <= 'Z')||LA18_0=='_'||(LA18_0 >= 'a' && LA18_0 <= 'z')) ) {
                    alt18=1;
                }


                switch (alt18) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( input.LA(1)=='!'||(input.LA(1) >= '#' && input.LA(1) <= '$')||(input.LA(1) >= '*' && input.LA(1) <= '+')||(input.LA(1) >= '-' && input.LA(1) <= '.')||(input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    break loop18;
                }
            } while (true);


            // grammar/Clojure.g:140:34: ( ':' ( SYMBOL_REST )+ )*
            loop20:
            do {
                int alt20=2;
                int LA20_0 = input.LA(1);

                if ( (LA20_0==':') ) {
                    alt20=1;
                }


                switch (alt20) {
            	case 1 :
            	    // grammar/Clojure.g:140:35: ':' ( SYMBOL_REST )+
            	    {
            	    match(':'); 

            	    // grammar/Clojure.g:140:39: ( SYMBOL_REST )+
            	    int cnt19=0;
            	    loop19:
            	    do {
            	        int alt19=2;
            	        int LA19_0 = input.LA(1);

            	        if ( (LA19_0=='!'||(LA19_0 >= '#' && LA19_0 <= '$')||(LA19_0 >= '*' && LA19_0 <= '+')||(LA19_0 >= '-' && LA19_0 <= '.')||(LA19_0 >= '0' && LA19_0 <= '9')||(LA19_0 >= '<' && LA19_0 <= '?')||(LA19_0 >= 'A' && LA19_0 <= 'Z')||LA19_0=='_'||(LA19_0 >= 'a' && LA19_0 <= 'z')) ) {
            	            alt19=1;
            	        }


            	        switch (alt19) {
            	    	case 1 :
            	    	    // grammar/Clojure.g:
            	    	    {
            	    	    if ( input.LA(1)=='!'||(input.LA(1) >= '#' && input.LA(1) <= '$')||(input.LA(1) >= '*' && input.LA(1) <= '+')||(input.LA(1) >= '-' && input.LA(1) <= '.')||(input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
            	    	        input.consume();
            	    	    }
            	    	    else {
            	    	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	    	        recover(mse);
            	    	        throw mse;
            	    	    }


            	    	    }
            	    	    break;

            	    	default :
            	    	    if ( cnt19 >= 1 ) break loop19;
            	                EarlyExitException eee =
            	                    new EarlyExitException(19, input);
            	                throw eee;
            	        }
            	        cnt19++;
            	    } while (true);


            	    }
            	    break;

            	default :
            	    break loop20;
                }
            } while (true);


            }


        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "NAME"

    // $ANTLR start "SYMBOL_HEAD"
    public final void mSYMBOL_HEAD() throws RecognitionException {
        try {
            // grammar/Clojure.g:144:12: ( 'a' .. 'z' | 'A' .. 'Z' | '*' | '+' | '!' | '-' | '_' | '?' | '>' | '<' | '=' | '$' )
            // grammar/Clojure.g:
            {
            if ( input.LA(1)=='!'||input.LA(1)=='$'||(input.LA(1) >= '*' && input.LA(1) <= '+')||input.LA(1)=='-'||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
                input.consume();
            }
            else {
                MismatchedSetException mse = new MismatchedSetException(null,input);
                recover(mse);
                throw mse;
            }


            }


        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SYMBOL_HEAD"

    // $ANTLR start "SYMBOL_REST"
    public final void mSYMBOL_REST() throws RecognitionException {
        try {
            // grammar/Clojure.g:150:12: ( SYMBOL_HEAD | '0' .. '9' | '.' | NUMBER_SIGN )
            // grammar/Clojure.g:
            {
            if ( input.LA(1)=='!'||(input.LA(1) >= '#' && input.LA(1) <= '$')||(input.LA(1) >= '*' && input.LA(1) <= '+')||(input.LA(1) >= '-' && input.LA(1) <= '.')||(input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
                input.consume();
            }
            else {
                MismatchedSetException mse = new MismatchedSetException(null,input);
                recover(mse);
                throw mse;
            }


            }


        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SYMBOL_REST"

    // $ANTLR start "KEYWORD"
    public final void mKEYWORD() throws RecognitionException {
        try {
            int _type = KEYWORD;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:165:8: ( ':' ( ':' )? ( SYMBOL_REST )+ ( '/' ( SYMBOL_REST )+ )? )
            // grammar/Clojure.g:166:9: ':' ( ':' )? ( SYMBOL_REST )+ ( '/' ( SYMBOL_REST )+ )?
            {
            match(':'); 

            // grammar/Clojure.g:166:13: ( ':' )?
            int alt21=2;
            int LA21_0 = input.LA(1);

            if ( (LA21_0==':') ) {
                alt21=1;
            }
            switch (alt21) {
                case 1 :
                    // grammar/Clojure.g:166:14: ':'
                    {
                    match(':'); 

                    }
                    break;

            }


            // grammar/Clojure.g:166:20: ( SYMBOL_REST )+
            int cnt22=0;
            loop22:
            do {
                int alt22=2;
                int LA22_0 = input.LA(1);

                if ( (LA22_0=='!'||(LA22_0 >= '#' && LA22_0 <= '$')||(LA22_0 >= '*' && LA22_0 <= '+')||(LA22_0 >= '-' && LA22_0 <= '.')||(LA22_0 >= '0' && LA22_0 <= '9')||(LA22_0 >= '<' && LA22_0 <= '?')||(LA22_0 >= 'A' && LA22_0 <= 'Z')||LA22_0=='_'||(LA22_0 >= 'a' && LA22_0 <= 'z')) ) {
                    alt22=1;
                }


                switch (alt22) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( input.LA(1)=='!'||(input.LA(1) >= '#' && input.LA(1) <= '$')||(input.LA(1) >= '*' && input.LA(1) <= '+')||(input.LA(1) >= '-' && input.LA(1) <= '.')||(input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    if ( cnt22 >= 1 ) break loop22;
                        EarlyExitException eee =
                            new EarlyExitException(22, input);
                        throw eee;
                }
                cnt22++;
            } while (true);


            // grammar/Clojure.g:166:33: ( '/' ( SYMBOL_REST )+ )?
            int alt24=2;
            int LA24_0 = input.LA(1);

            if ( (LA24_0=='/') ) {
                alt24=1;
            }
            switch (alt24) {
                case 1 :
                    // grammar/Clojure.g:166:34: '/' ( SYMBOL_REST )+
                    {
                    match('/'); 

                    // grammar/Clojure.g:166:38: ( SYMBOL_REST )+
                    int cnt23=0;
                    loop23:
                    do {
                        int alt23=2;
                        int LA23_0 = input.LA(1);

                        if ( (LA23_0=='!'||(LA23_0 >= '#' && LA23_0 <= '$')||(LA23_0 >= '*' && LA23_0 <= '+')||(LA23_0 >= '-' && LA23_0 <= '.')||(LA23_0 >= '0' && LA23_0 <= '9')||(LA23_0 >= '<' && LA23_0 <= '?')||(LA23_0 >= 'A' && LA23_0 <= 'Z')||LA23_0=='_'||(LA23_0 >= 'a' && LA23_0 <= 'z')) ) {
                            alt23=1;
                        }


                        switch (alt23) {
                    	case 1 :
                    	    // grammar/Clojure.g:
                    	    {
                    	    if ( input.LA(1)=='!'||(input.LA(1) >= '#' && input.LA(1) <= '$')||(input.LA(1) >= '*' && input.LA(1) <= '+')||(input.LA(1) >= '-' && input.LA(1) <= '.')||(input.LA(1) >= '0' && input.LA(1) <= '9')||(input.LA(1) >= '<' && input.LA(1) <= '?')||(input.LA(1) >= 'A' && input.LA(1) <= 'Z')||input.LA(1)=='_'||(input.LA(1) >= 'a' && input.LA(1) <= 'z') ) {
                    	        input.consume();
                    	    }
                    	    else {
                    	        MismatchedSetException mse = new MismatchedSetException(null,input);
                    	        recover(mse);
                    	        throw mse;
                    	    }


                    	    }
                    	    break;

                    	default :
                    	    if ( cnt23 >= 1 ) break loop23;
                                EarlyExitException eee =
                                    new EarlyExitException(23, input);
                                throw eee;
                        }
                        cnt23++;
                    } while (true);


                    }
                    break;

            }


            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "KEYWORD"

    // $ANTLR start "SYNTAX_QUOTE"
    public final void mSYNTAX_QUOTE() throws RecognitionException {
        try {
            int _type = SYNTAX_QUOTE;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:169:13: ( '`' )
            // grammar/Clojure.g:170:9: '`'
            {
            match('`'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SYNTAX_QUOTE"

    // $ANTLR start "UNQUOTE_SPLICING"
    public final void mUNQUOTE_SPLICING() throws RecognitionException {
        try {
            int _type = UNQUOTE_SPLICING;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:173:17: ( '~@' )
            // grammar/Clojure.g:174:9: '~@'
            {
            match("~@"); 



            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "UNQUOTE_SPLICING"

    // $ANTLR start "UNQUOTE"
    public final void mUNQUOTE() throws RecognitionException {
        try {
            int _type = UNQUOTE;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:177:8: ( '~' )
            // grammar/Clojure.g:178:9: '~'
            {
            match('~'); 

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "UNQUOTE"

    // $ANTLR start "COMMENT"
    public final void mCOMMENT() throws RecognitionException {
        try {
            int _type = COMMENT;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:181:8: ( ';' (~ ( '\\r' | '\\n' ) )* ( ( '\\r' )? '\\n' )? )
            // grammar/Clojure.g:182:9: ';' (~ ( '\\r' | '\\n' ) )* ( ( '\\r' )? '\\n' )?
            {
            match(';'); 

            // grammar/Clojure.g:182:13: (~ ( '\\r' | '\\n' ) )*
            loop25:
            do {
                int alt25=2;
                int LA25_0 = input.LA(1);

                if ( ((LA25_0 >= '\u0000' && LA25_0 <= '\t')||(LA25_0 >= '\u000B' && LA25_0 <= '\f')||(LA25_0 >= '\u000E' && LA25_0 <= '\uFFFF')) ) {
                    alt25=1;
                }


                switch (alt25) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( (input.LA(1) >= '\u0000' && input.LA(1) <= '\t')||(input.LA(1) >= '\u000B' && input.LA(1) <= '\f')||(input.LA(1) >= '\u000E' && input.LA(1) <= '\uFFFF') ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    break loop25;
                }
            } while (true);


            // grammar/Clojure.g:182:29: ( ( '\\r' )? '\\n' )?
            int alt27=2;
            int LA27_0 = input.LA(1);

            if ( (LA27_0=='\n'||LA27_0=='\r') ) {
                alt27=1;
            }
            switch (alt27) {
                case 1 :
                    // grammar/Clojure.g:182:30: ( '\\r' )? '\\n'
                    {
                    // grammar/Clojure.g:182:30: ( '\\r' )?
                    int alt26=2;
                    int LA26_0 = input.LA(1);

                    if ( (LA26_0=='\r') ) {
                        alt26=1;
                    }
                    switch (alt26) {
                        case 1 :
                            // grammar/Clojure.g:182:30: '\\r'
                            {
                            match('\r'); 

                            }
                            break;

                    }


                    match('\n'); 

                    }
                    break;

            }


            _channel=HIDDEN;

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "COMMENT"

    // $ANTLR start "SPACE"
    public final void mSPACE() throws RecognitionException {
        try {
            int _type = SPACE;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:185:6: ( ( ' ' | '\\t' | ',' | '\\r' | '\\n' )+ )
            // grammar/Clojure.g:185:9: ( ' ' | '\\t' | ',' | '\\r' | '\\n' )+
            {
            // grammar/Clojure.g:185:9: ( ' ' | '\\t' | ',' | '\\r' | '\\n' )+
            int cnt28=0;
            loop28:
            do {
                int alt28=2;
                int LA28_0 = input.LA(1);

                if ( ((LA28_0 >= '\t' && LA28_0 <= '\n')||LA28_0=='\r'||LA28_0==' '||LA28_0==',') ) {
                    alt28=1;
                }


                switch (alt28) {
            	case 1 :
            	    // grammar/Clojure.g:
            	    {
            	    if ( (input.LA(1) >= '\t' && input.LA(1) <= '\n')||input.LA(1)=='\r'||input.LA(1)==' '||input.LA(1)==',' ) {
            	        input.consume();
            	    }
            	    else {
            	        MismatchedSetException mse = new MismatchedSetException(null,input);
            	        recover(mse);
            	        throw mse;
            	    }


            	    }
            	    break;

            	default :
            	    if ( cnt28 >= 1 ) break loop28;
                        EarlyExitException eee =
                            new EarlyExitException(28, input);
                        throw eee;
                }
                cnt28++;
            } while (true);


            _channel=HIDDEN;

            }

            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "SPACE"

    // $ANTLR start "LAMBDA_ARG"
    public final void mLAMBDA_ARG() throws RecognitionException {
        try {
            int _type = LAMBDA_ARG;
            int _channel = DEFAULT_TOKEN_CHANNEL;
            // grammar/Clojure.g:189:11: ( '%' '1' .. '9' ( '0' .. '9' )* | '%&' | '%' )
            int alt30=3;
            int LA30_0 = input.LA(1);

            if ( (LA30_0=='%') ) {
                switch ( input.LA(2) ) {
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    {
                    alt30=1;
                    }
                    break;
                case '&':
                    {
                    alt30=2;
                    }
                    break;
                default:
                    alt30=3;
                }

            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 30, 0, input);

                throw nvae;

            }
            switch (alt30) {
                case 1 :
                    // grammar/Clojure.g:190:9: '%' '1' .. '9' ( '0' .. '9' )*
                    {
                    match('%'); 

                    matchRange('1','9'); 

                    // grammar/Clojure.g:190:22: ( '0' .. '9' )*
                    loop29:
                    do {
                        int alt29=2;
                        int LA29_0 = input.LA(1);

                        if ( ((LA29_0 >= '0' && LA29_0 <= '9')) ) {
                            alt29=1;
                        }


                        switch (alt29) {
                    	case 1 :
                    	    // grammar/Clojure.g:
                    	    {
                    	    if ( (input.LA(1) >= '0' && input.LA(1) <= '9') ) {
                    	        input.consume();
                    	    }
                    	    else {
                    	        MismatchedSetException mse = new MismatchedSetException(null,input);
                    	        recover(mse);
                    	        throw mse;
                    	    }


                    	    }
                    	    break;

                    	default :
                    	    break loop29;
                        }
                    } while (true);


                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:191:9: '%&'
                    {
                    match("%&"); 



                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:192:9: '%'
                    {
                    match('%'); 

                    }
                    break;

            }
            state.type = _type;
            state.channel = _channel;
        }
        finally {
        	// do for sure before leaving
        }
    }
    // $ANTLR end "LAMBDA_ARG"

    public void mTokens() throws RecognitionException {
        // grammar/Clojure.g:1:8: ( OPEN_PAREN | CLOSE_PAREN | AMPERSAND | LEFT_SQUARE_BRACKET | RIGHT_SQUARE_BRACKET | LEFT_CURLY_BRACKET | RIGHT_CURLY_BRACKET | BACKSLASH | CIRCUMFLEX | COMMERCIAL_AT | NUMBER_SIGN | APOSTROPHE | SPECIAL_FORM | STRING | REGEX_LITERAL | NUMBER | CHARACTER | HEXDIGIT | NIL | BOOLEAN | SYMBOL | METADATA_TYPEHINT | KEYWORD | SYNTAX_QUOTE | UNQUOTE_SPLICING | UNQUOTE | COMMENT | SPACE | LAMBDA_ARG )
        int alt31=29;
        alt31 = dfa31.predict(input);
        switch (alt31) {
            case 1 :
                // grammar/Clojure.g:1:10: OPEN_PAREN
                {
                mOPEN_PAREN(); 


                }
                break;
            case 2 :
                // grammar/Clojure.g:1:21: CLOSE_PAREN
                {
                mCLOSE_PAREN(); 


                }
                break;
            case 3 :
                // grammar/Clojure.g:1:33: AMPERSAND
                {
                mAMPERSAND(); 


                }
                break;
            case 4 :
                // grammar/Clojure.g:1:43: LEFT_SQUARE_BRACKET
                {
                mLEFT_SQUARE_BRACKET(); 


                }
                break;
            case 5 :
                // grammar/Clojure.g:1:63: RIGHT_SQUARE_BRACKET
                {
                mRIGHT_SQUARE_BRACKET(); 


                }
                break;
            case 6 :
                // grammar/Clojure.g:1:84: LEFT_CURLY_BRACKET
                {
                mLEFT_CURLY_BRACKET(); 


                }
                break;
            case 7 :
                // grammar/Clojure.g:1:103: RIGHT_CURLY_BRACKET
                {
                mRIGHT_CURLY_BRACKET(); 


                }
                break;
            case 8 :
                // grammar/Clojure.g:1:123: BACKSLASH
                {
                mBACKSLASH(); 


                }
                break;
            case 9 :
                // grammar/Clojure.g:1:133: CIRCUMFLEX
                {
                mCIRCUMFLEX(); 


                }
                break;
            case 10 :
                // grammar/Clojure.g:1:144: COMMERCIAL_AT
                {
                mCOMMERCIAL_AT(); 


                }
                break;
            case 11 :
                // grammar/Clojure.g:1:158: NUMBER_SIGN
                {
                mNUMBER_SIGN(); 


                }
                break;
            case 12 :
                // grammar/Clojure.g:1:170: APOSTROPHE
                {
                mAPOSTROPHE(); 


                }
                break;
            case 13 :
                // grammar/Clojure.g:1:181: SPECIAL_FORM
                {
                mSPECIAL_FORM(); 


                }
                break;
            case 14 :
                // grammar/Clojure.g:1:194: STRING
                {
                mSTRING(); 


                }
                break;
            case 15 :
                // grammar/Clojure.g:1:201: REGEX_LITERAL
                {
                mREGEX_LITERAL(); 


                }
                break;
            case 16 :
                // grammar/Clojure.g:1:215: NUMBER
                {
                mNUMBER(); 


                }
                break;
            case 17 :
                // grammar/Clojure.g:1:222: CHARACTER
                {
                mCHARACTER(); 


                }
                break;
            case 18 :
                // grammar/Clojure.g:1:232: HEXDIGIT
                {
                mHEXDIGIT(); 


                }
                break;
            case 19 :
                // grammar/Clojure.g:1:241: NIL
                {
                mNIL(); 


                }
                break;
            case 20 :
                // grammar/Clojure.g:1:245: BOOLEAN
                {
                mBOOLEAN(); 


                }
                break;
            case 21 :
                // grammar/Clojure.g:1:253: SYMBOL
                {
                mSYMBOL(); 


                }
                break;
            case 22 :
                // grammar/Clojure.g:1:260: METADATA_TYPEHINT
                {
                mMETADATA_TYPEHINT(); 


                }
                break;
            case 23 :
                // grammar/Clojure.g:1:278: KEYWORD
                {
                mKEYWORD(); 


                }
                break;
            case 24 :
                // grammar/Clojure.g:1:286: SYNTAX_QUOTE
                {
                mSYNTAX_QUOTE(); 


                }
                break;
            case 25 :
                // grammar/Clojure.g:1:299: UNQUOTE_SPLICING
                {
                mUNQUOTE_SPLICING(); 


                }
                break;
            case 26 :
                // grammar/Clojure.g:1:316: UNQUOTE
                {
                mUNQUOTE(); 


                }
                break;
            case 27 :
                // grammar/Clojure.g:1:324: COMMENT
                {
                mCOMMENT(); 


                }
                break;
            case 28 :
                // grammar/Clojure.g:1:332: SPACE
                {
                mSPACE(); 


                }
                break;
            case 29 :
                // grammar/Clojure.g:1:338: LAMBDA_ARG
                {
                mLAMBDA_ARG(); 


                }
                break;

        }

    }


    protected DFA31 dfa31 = new DFA31(this);
    static final String DFA31_eotS =
        "\10\uffff\1\45\1\46\1\uffff\1\50\1\uffff\1\54\4\35\1\54\5\35\2\uffff"+
        "\1\35\1\uffff\1\54\3\uffff\1\76\11\uffff\1\35\1\30\1\uffff\1\30"+
        "\4\35\1\30\10\35\1\74\3\uffff\2\30\2\35\1\30\3\35\1\30\2\35\1\30"+
        "\1\126\3\35\1\30\4\35\1\137\1\35\1\uffff\1\30\1\74\1\35\1\74\1\30"+
        "\1\137\2\30\1\uffff\12\35\2\30";
    static final String DFA31_eofS =
        "\154\uffff";
    static final String DFA31_minS =
        "\1\11\7\uffff\1\0\1\41\1\uffff\1\42\1\uffff\1\41\1\146\1\145\1\165"+
        "\1\141\1\41\1\145\1\150\1\157\2\145\2\uffff\1\60\1\uffff\1\41\3"+
        "\uffff\1\100\11\uffff\1\146\1\41\1\uffff\1\41\1\164\2\157\1\162"+
        "\1\41\1\154\1\143\1\162\1\165\1\156\1\167\1\154\1\164\1\41\3\uffff"+
        "\2\41\1\160\1\164\1\41\1\163\1\165\1\157\1\41\1\145\1\151\3\41\1"+
        "\60\1\55\1\41\2\145\1\162\1\167\1\41\1\164\1\uffff\2\41\1\60\5\41"+
        "\1\uffff\1\157\1\162\1\55\1\145\1\156\1\164\1\151\1\145\1\164\1"+
        "\162\2\41";
    static final String DFA31_maxS =
        "\1\176\7\uffff\1\uffff\1\172\1\uffff\1\136\1\uffff\1\172\1\146\1"+
        "\157\1\165\1\141\1\172\1\145\1\162\1\157\1\151\1\145\2\uffff\1\71"+
        "\1\uffff\1\172\3\uffff\1\100\11\uffff\1\146\1\172\1\uffff\1\172"+
        "\1\164\2\157\1\162\1\172\1\154\1\143\1\162\1\171\1\156\1\167\1\154"+
        "\1\164\1\172\3\uffff\2\172\1\160\1\164\1\172\1\163\1\165\1\157\1"+
        "\172\1\145\1\151\2\172\1\41\2\71\1\172\2\145\1\162\1\167\1\172\1"+
        "\164\1\uffff\2\172\1\71\5\172\1\uffff\1\157\1\162\1\55\1\145\1\170"+
        "\1\164\1\151\1\145\1\164\1\162\2\172";
    static final String DFA31_acceptS =
        "\1\uffff\1\1\1\2\1\3\1\4\1\5\1\6\1\7\2\uffff\1\12\1\uffff\1\14\13"+
        "\uffff\1\15\1\16\1\uffff\1\20\1\uffff\1\25\1\27\1\30\1\uffff\1\33"+
        "\1\34\1\35\1\21\1\10\1\11\1\26\1\13\1\17\2\uffff\1\22\17\uffff\1"+
        "\20\1\31\1\32\27\uffff\1\23\10\uffff\1\24\14\uffff";
    static final String DFA31_specialS =
        "\10\uffff\1\0\143\uffff}>";
    static final String[] DFA31_transitionS = {
            "\2\42\2\uffff\1\42\22\uffff\1\42\1\35\1\31\1\13\1\35\1\43\1"+
            "\3\1\14\1\1\1\2\2\35\1\42\1\32\1\30\1\35\12\33\1\36\1\41\4\35"+
            "\1\12\6\34\24\35\1\4\1\10\1\5\1\11\1\35\1\37\3\34\1\15\1\34"+
            "\1\22\2\35\1\16\2\35\1\17\1\25\1\26\2\35\1\20\1\23\1\27\1\24"+
            "\1\35\1\21\4\35\1\6\1\uffff\1\7\1\40",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "\0\44",
            "\2\47\1\uffff\1\47\5\uffff\2\47\1\uffff\1\47\16\uffff\4\47"+
            "\1\uffff\32\47\4\uffff\1\47\1\uffff\32\47",
            "",
            "\1\51\1\47\72\uffff\1\47",
            "",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\4\35\1\52\11\35\1\53\13"+
            "\35",
            "\1\55",
            "\1\56\11\uffff\1\57",
            "\1\60",
            "\1\61",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\1\63\14\35\1\62\14\35",
            "\1\64",
            "\1\65\11\uffff\1\66",
            "\1\67",
            "\1\70\3\uffff\1\71",
            "\1\72",
            "",
            "",
            "\12\73",
            "",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "",
            "",
            "",
            "\1\75",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "\1\77",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\100",
            "\1\101",
            "\1\102",
            "\1\103",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\104",
            "\1\105",
            "\1\106",
            "\1\110\3\uffff\1\107",
            "\1\111",
            "\1\112",
            "\1\113",
            "\1\114",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\1\35\1\115\1\35\12"+
            "\73\1\35\1\uffff\4\35\1\uffff\4\35\1\116\25\35\4\uffff\1\35"+
            "\1\uffff\4\35\1\116\25\35",
            "",
            "",
            "",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\117",
            "\1\120",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\121",
            "\1\122",
            "\1\123",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\124",
            "\1\125",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\127",
            "\12\130",
            "\1\131\2\uffff\12\132",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\133",
            "\1\134",
            "\1\135",
            "\1\136",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\140",
            "",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\3\35\12\130\1\35\1"+
            "\uffff\4\35\1\uffff\4\35\1\116\25\35\4\uffff\1\35\1\uffff\4"+
            "\35\1\116\25\35",
            "\12\132",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\3\35\12\132\1\35\1"+
            "\uffff\4\35\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "",
            "\1\141",
            "\1\142",
            "\1\143",
            "\1\144",
            "\1\145\11\uffff\1\146",
            "\1\147",
            "\1\150",
            "\1\151",
            "\1\152",
            "\1\153",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35",
            "\1\35\1\uffff\2\35\5\uffff\2\35\1\uffff\16\35\1\uffff\4\35"+
            "\1\uffff\32\35\4\uffff\1\35\1\uffff\32\35"
    };

    static final short[] DFA31_eot = DFA.unpackEncodedString(DFA31_eotS);
    static final short[] DFA31_eof = DFA.unpackEncodedString(DFA31_eofS);
    static final char[] DFA31_min = DFA.unpackEncodedStringToUnsignedChars(DFA31_minS);
    static final char[] DFA31_max = DFA.unpackEncodedStringToUnsignedChars(DFA31_maxS);
    static final short[] DFA31_accept = DFA.unpackEncodedString(DFA31_acceptS);
    static final short[] DFA31_special = DFA.unpackEncodedString(DFA31_specialS);
    static final short[][] DFA31_transition;

    static {
        int numStates = DFA31_transitionS.length;
        DFA31_transition = new short[numStates][];
        for (int i=0; i<numStates; i++) {
            DFA31_transition[i] = DFA.unpackEncodedString(DFA31_transitionS[i]);
        }
    }

    class DFA31 extends DFA {

        public DFA31(BaseRecognizer recognizer) {
            this.recognizer = recognizer;
            this.decisionNumber = 31;
            this.eot = DFA31_eot;
            this.eof = DFA31_eof;
            this.min = DFA31_min;
            this.max = DFA31_max;
            this.accept = DFA31_accept;
            this.special = DFA31_special;
            this.transition = DFA31_transition;
        }
        public String getDescription() {
            return "1:1: Tokens : ( OPEN_PAREN | CLOSE_PAREN | AMPERSAND | LEFT_SQUARE_BRACKET | RIGHT_SQUARE_BRACKET | LEFT_CURLY_BRACKET | RIGHT_CURLY_BRACKET | BACKSLASH | CIRCUMFLEX | COMMERCIAL_AT | NUMBER_SIGN | APOSTROPHE | SPECIAL_FORM | STRING | REGEX_LITERAL | NUMBER | CHARACTER | HEXDIGIT | NIL | BOOLEAN | SYMBOL | METADATA_TYPEHINT | KEYWORD | SYNTAX_QUOTE | UNQUOTE_SPLICING | UNQUOTE | COMMENT | SPACE | LAMBDA_ARG );";
        }
        public int specialStateTransition(int s, IntStream _input) throws NoViableAltException {
            IntStream input = _input;
        	int _s = s;
            switch ( s ) {
                    case 0 : 
                        int LA31_8 = input.LA(1);

                        s = -1;
                        if ( ((LA31_8 >= '\u0000' && LA31_8 <= '\uFFFF')) ) {s = 36;}

                        else s = 37;

                        if ( s>=0 ) return s;
                        break;
            }
            NoViableAltException nvae =
                new NoViableAltException(getDescription(), 31, _s, input);
            error(nvae);
            throw nvae;
        }

    }
 

}