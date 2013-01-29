// $ANTLR 3.4 grammar/Clojure.g 2013-01-21 18:43:35
package blue.ui.editor.clojure.antlr; 

import org.antlr.runtime.*;
import java.util.Stack;
import java.util.List;
import java.util.ArrayList;

@SuppressWarnings({"all", "warnings", "unchecked"})
public class ClojureParser extends Parser {
    public static final String[] tokenNames = new String[] {
        "<invalid>", "<EOR>", "<DOWN>", "<UP>", "AMPERSAND", "APOSTROPHE", "BACKSLASH", "BOOLEAN", "CHARACTER", "CIRCUMFLEX", "CLOSE_PAREN", "COMMENT", "COMMERCIAL_AT", "EscapeSequence", "HEXDIGIT", "KEYWORD", "LAMBDA_ARG", "LEFT_CURLY_BRACKET", "LEFT_SQUARE_BRACKET", "METADATA_TYPEHINT", "NAME", "NIL", "NUMBER", "NUMBER_SIGN", "OPEN_PAREN", "OctalEscape", "REGEX_LITERAL", "RIGHT_CURLY_BRACKET", "RIGHT_SQUARE_BRACKET", "SPACE", "SPECIAL_FORM", "STRING", "SYMBOL", "SYMBOL_HEAD", "SYMBOL_REST", "SYNTAX_QUOTE", "UNQUOTE", "UNQUOTE_SPLICING", "UnicodeEscape"
    };

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
    public Parser[] getDelegates() {
        return new Parser[] {};
    }

    // delegators


    public ClojureParser(TokenStream input) {
        this(input, new RecognizerSharedState());
    }
    public ClojureParser(TokenStream input, RecognizerSharedState state) {
        super(input, state);
    }

    public String[] getTokenNames() { return ClojureParser.tokenNames; }
    public String getGrammarFileName() { return "grammar/Clojure.g"; }


    boolean inLambda=false;
    int syntaxQuoteDepth = 0;

    java.util.List symbols = new java.util.ArrayList();
    public List getCollectedSymbols() { return symbols; }
    // TODO envisage to remove this when the grammar is fully tested ?
    //public void recover(IntStream input, RecognitionException re) {
    //	throw new RuntimeException("Not recovering from RecognitionException, na!", re);
    //}
    //}

    //@lexer::members {
    java.util.Map parensMatching = new java.util.HashMap(); 
    public Integer matchingParenForPosition(Integer position) {
      return (Integer) parensMatching.get(position);
    }
    public void clearParensMatching() { parensMatching.clear(); }



    // $ANTLR start "literal"
    // grammar/Clojure.g:156:1: literal : ( STRING | NUMBER | CHARACTER | NIL | BOOLEAN | KEYWORD );
    public final void literal() throws RecognitionException {
        try {
            // grammar/Clojure.g:156:8: ( STRING | NUMBER | CHARACTER | NIL | BOOLEAN | KEYWORD )
            // grammar/Clojure.g:
            {
            if ( (input.LA(1) >= BOOLEAN && input.LA(1) <= CHARACTER)||input.LA(1)==KEYWORD||(input.LA(1) >= NIL && input.LA(1) <= NUMBER)||input.LA(1)==STRING ) {
                input.consume();
                state.errorRecovery=false;
            }
            else {
                MismatchedSetException mse = new MismatchedSetException(null,input);
                throw mse;
            }


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "literal"



    // $ANTLR start "file"
    // grammar/Clojure.g:199:1: file : ( form )* ;
    public final void file() throws RecognitionException {
        try {
            // grammar/Clojure.g:199:5: ( ( form )* )
            // grammar/Clojure.g:200:9: ( form )*
            {
            // grammar/Clojure.g:200:9: ( form )*
            loop1:
            do {
                int alt1=2;
                int LA1_0 = input.LA(1);

                if ( ((LA1_0 >= AMPERSAND && LA1_0 <= APOSTROPHE)||(LA1_0 >= BOOLEAN && LA1_0 <= CIRCUMFLEX)||(LA1_0 >= COMMENT && LA1_0 <= COMMERCIAL_AT)||(LA1_0 >= KEYWORD && LA1_0 <= LEFT_SQUARE_BRACKET)||(LA1_0 >= NIL && LA1_0 <= OPEN_PAREN)||LA1_0==REGEX_LITERAL||(LA1_0 >= SPECIAL_FORM && LA1_0 <= SYMBOL)||(LA1_0 >= SYNTAX_QUOTE && LA1_0 <= UNQUOTE_SPLICING)) ) {
                    alt1=1;
                }


                switch (alt1) {
            	case 1 :
            	    // grammar/Clojure.g:200:11: form
            	    {
            	    pushFollow(FOLLOW_form_in_file1304);
            	    form();

            	    state._fsp--;


            	     System.out.println("form found"); 

            	    }
            	    break;

            	default :
            	    break loop1;
                }
            } while (true);


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "file"



    // $ANTLR start "form"
    // grammar/Clojure.g:204:1: form : ({...}? LAMBDA_ARG | literal | COMMENT | AMPERSAND | ( metadataForm )? ( SPECIAL_FORM |s= SYMBOL | list | vector | map ) | macroForm | dispatchMacroForm | set );
    public final void form() throws RecognitionException {
        Token s=null;

        try {
            // grammar/Clojure.g:204:6: ({...}? LAMBDA_ARG | literal | COMMENT | AMPERSAND | ( metadataForm )? ( SPECIAL_FORM |s= SYMBOL | list | vector | map ) | macroForm | dispatchMacroForm | set )
            int alt4=8;
            switch ( input.LA(1) ) {
            case LAMBDA_ARG:
                {
                alt4=1;
                }
                break;
            case BOOLEAN:
            case CHARACTER:
            case KEYWORD:
            case NIL:
            case NUMBER:
            case STRING:
                {
                alt4=2;
                }
                break;
            case COMMENT:
                {
                alt4=3;
                }
                break;
            case AMPERSAND:
                {
                alt4=4;
                }
                break;
            case NUMBER_SIGN:
                {
                switch ( input.LA(2) ) {
                case CIRCUMFLEX:
                    {
                    alt4=5;
                    }
                    break;
                case APOSTROPHE:
                case OPEN_PAREN:
                    {
                    alt4=7;
                    }
                    break;
                case LEFT_CURLY_BRACKET:
                    {
                    alt4=8;
                    }
                    break;
                default:
                    NoViableAltException nvae =
                        new NoViableAltException("", 4, 5, input);

                    throw nvae;

                }

                }
                break;
            case LEFT_CURLY_BRACKET:
            case LEFT_SQUARE_BRACKET:
            case OPEN_PAREN:
            case SPECIAL_FORM:
            case SYMBOL:
                {
                alt4=5;
                }
                break;
            case APOSTROPHE:
            case CIRCUMFLEX:
            case COMMERCIAL_AT:
            case SYNTAX_QUOTE:
            case UNQUOTE:
            case UNQUOTE_SPLICING:
                {
                alt4=6;
                }
                break;
            case REGEX_LITERAL:
                {
                alt4=7;
                }
                break;
            default:
                NoViableAltException nvae =
                    new NoViableAltException("", 4, 0, input);

                throw nvae;

            }

            switch (alt4) {
                case 1 :
                    // grammar/Clojure.g:205:3: {...}? LAMBDA_ARG
                    {
                    if ( !((this.inLambda)) ) {
                        throw new FailedPredicateException(input, "form", "this.inLambda");
                    }

                    match(input,LAMBDA_ARG,FOLLOW_LAMBDA_ARG_in_form1337); 

                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:206:10: literal
                    {
                    pushFollow(FOLLOW_literal_in_form1348);
                    literal();

                    state._fsp--;


                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:208:7: COMMENT
                    {
                    match(input,COMMENT,FOLLOW_COMMENT_in_form1374); 

                    }
                    break;
                case 4 :
                    // grammar/Clojure.g:209:9: AMPERSAND
                    {
                    match(input,AMPERSAND,FOLLOW_AMPERSAND_in_form1384); 

                    }
                    break;
                case 5 :
                    // grammar/Clojure.g:210:9: ( metadataForm )? ( SPECIAL_FORM |s= SYMBOL | list | vector | map )
                    {
                    // grammar/Clojure.g:210:9: ( metadataForm )?
                    int alt2=2;
                    int LA2_0 = input.LA(1);

                    if ( (LA2_0==NUMBER_SIGN) ) {
                        alt2=1;
                    }
                    switch (alt2) {
                        case 1 :
                            // grammar/Clojure.g:210:9: metadataForm
                            {
                            pushFollow(FOLLOW_metadataForm_in_form1394);
                            metadataForm();

                            state._fsp--;


                            }
                            break;

                    }


                    // grammar/Clojure.g:210:23: ( SPECIAL_FORM |s= SYMBOL | list | vector | map )
                    int alt3=5;
                    switch ( input.LA(1) ) {
                    case SPECIAL_FORM:
                        {
                        alt3=1;
                        }
                        break;
                    case SYMBOL:
                        {
                        alt3=2;
                        }
                        break;
                    case OPEN_PAREN:
                        {
                        alt3=3;
                        }
                        break;
                    case LEFT_SQUARE_BRACKET:
                        {
                        alt3=4;
                        }
                        break;
                    case LEFT_CURLY_BRACKET:
                        {
                        alt3=5;
                        }
                        break;
                    default:
                        NoViableAltException nvae =
                            new NoViableAltException("", 3, 0, input);

                        throw nvae;

                    }

                    switch (alt3) {
                        case 1 :
                            // grammar/Clojure.g:210:25: SPECIAL_FORM
                            {
                            match(input,SPECIAL_FORM,FOLLOW_SPECIAL_FORM_in_form1399); 

                            }
                            break;
                        case 2 :
                            // grammar/Clojure.g:210:40: s= SYMBOL
                            {
                            s=(Token)match(input,SYMBOL,FOLLOW_SYMBOL_in_form1405); 

                             symbols.add(s.getText()); 

                            }
                            break;
                        case 3 :
                            // grammar/Clojure.g:210:81: list
                            {
                            pushFollow(FOLLOW_list_in_form1411);
                            list();

                            state._fsp--;


                            }
                            break;
                        case 4 :
                            // grammar/Clojure.g:210:88: vector
                            {
                            pushFollow(FOLLOW_vector_in_form1415);
                            vector();

                            state._fsp--;


                            }
                            break;
                        case 5 :
                            // grammar/Clojure.g:210:97: map
                            {
                            pushFollow(FOLLOW_map_in_form1419);
                            map();

                            state._fsp--;


                            }
                            break;

                    }


                    }
                    break;
                case 6 :
                    // grammar/Clojure.g:211:9: macroForm
                    {
                    pushFollow(FOLLOW_macroForm_in_form1431);
                    macroForm();

                    state._fsp--;


                    }
                    break;
                case 7 :
                    // grammar/Clojure.g:212:9: dispatchMacroForm
                    {
                    pushFollow(FOLLOW_dispatchMacroForm_in_form1441);
                    dispatchMacroForm();

                    state._fsp--;


                    }
                    break;
                case 8 :
                    // grammar/Clojure.g:213:9: set
                    {
                    pushFollow(FOLLOW_set_in_form1451);
                    set();

                    state._fsp--;


                    }
                    break;

            }
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "form"



    // $ANTLR start "macroForm"
    // grammar/Clojure.g:216:1: macroForm : ( quoteForm | metaForm | derefForm | syntaxQuoteForm |{...}? unquoteSplicingForm |{...}? unquoteForm );
    public final void macroForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:216:10: ( quoteForm | metaForm | derefForm | syntaxQuoteForm |{...}? unquoteSplicingForm |{...}? unquoteForm )
            int alt5=6;
            switch ( input.LA(1) ) {
            case APOSTROPHE:
                {
                alt5=1;
                }
                break;
            case CIRCUMFLEX:
                {
                alt5=2;
                }
                break;
            case COMMERCIAL_AT:
                {
                alt5=3;
                }
                break;
            case SYNTAX_QUOTE:
                {
                alt5=4;
                }
                break;
            case UNQUOTE_SPLICING:
                {
                alt5=5;
                }
                break;
            case UNQUOTE:
                {
                alt5=6;
                }
                break;
            default:
                NoViableAltException nvae =
                    new NoViableAltException("", 5, 0, input);

                throw nvae;

            }

            switch (alt5) {
                case 1 :
                    // grammar/Clojure.g:217:9: quoteForm
                    {
                    pushFollow(FOLLOW_quoteForm_in_macroForm1482);
                    quoteForm();

                    state._fsp--;


                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:218:9: metaForm
                    {
                    pushFollow(FOLLOW_metaForm_in_macroForm1492);
                    metaForm();

                    state._fsp--;


                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:219:9: derefForm
                    {
                    pushFollow(FOLLOW_derefForm_in_macroForm1502);
                    derefForm();

                    state._fsp--;


                    }
                    break;
                case 4 :
                    // grammar/Clojure.g:220:9: syntaxQuoteForm
                    {
                    pushFollow(FOLLOW_syntaxQuoteForm_in_macroForm1512);
                    syntaxQuoteForm();

                    state._fsp--;


                    }
                    break;
                case 5 :
                    // grammar/Clojure.g:221:7: {...}? unquoteSplicingForm
                    {
                    if ( !(( this.syntaxQuoteDepth > 0 )) ) {
                        throw new FailedPredicateException(input, "macroForm", " this.syntaxQuoteDepth > 0 ");
                    }

                    pushFollow(FOLLOW_unquoteSplicingForm_in_macroForm1522);
                    unquoteSplicingForm();

                    state._fsp--;


                    }
                    break;
                case 6 :
                    // grammar/Clojure.g:222:7: {...}? unquoteForm
                    {
                    if ( !(( this.syntaxQuoteDepth > 0 )) ) {
                        throw new FailedPredicateException(input, "macroForm", " this.syntaxQuoteDepth > 0 ");
                    }

                    pushFollow(FOLLOW_unquoteForm_in_macroForm1532);
                    unquoteForm();

                    state._fsp--;


                    }
                    break;

            }
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "macroForm"



    // $ANTLR start "dispatchMacroForm"
    // grammar/Clojure.g:225:1: dispatchMacroForm : ( REGEX_LITERAL | varQuoteForm |{...}? lambdaForm );
    public final void dispatchMacroForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:225:18: ( REGEX_LITERAL | varQuoteForm |{...}? lambdaForm )
            int alt6=3;
            int LA6_0 = input.LA(1);

            if ( (LA6_0==REGEX_LITERAL) ) {
                alt6=1;
            }
            else if ( (LA6_0==NUMBER_SIGN) ) {
                int LA6_2 = input.LA(2);

                if ( (LA6_2==APOSTROPHE) ) {
                    alt6=2;
                }
                else if ( (LA6_2==OPEN_PAREN) ) {
                    alt6=3;
                }
                else {
                    NoViableAltException nvae =
                        new NoViableAltException("", 6, 2, input);

                    throw nvae;

                }
            }
            else {
                NoViableAltException nvae =
                    new NoViableAltException("", 6, 0, input);

                throw nvae;

            }
            switch (alt6) {
                case 1 :
                    // grammar/Clojure.g:226:9: REGEX_LITERAL
                    {
                    match(input,REGEX_LITERAL,FOLLOW_REGEX_LITERAL_in_dispatchMacroForm1559); 

                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:227:9: varQuoteForm
                    {
                    pushFollow(FOLLOW_varQuoteForm_in_dispatchMacroForm1569);
                    varQuoteForm();

                    state._fsp--;


                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:228:9: {...}? lambdaForm
                    {
                    if ( !((!this.inLambda)) ) {
                        throw new FailedPredicateException(input, "dispatchMacroForm", "!this.inLambda");
                    }

                    pushFollow(FOLLOW_lambdaForm_in_dispatchMacroForm1581);
                    lambdaForm();

                    state._fsp--;


                    }
                    break;

            }
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "dispatchMacroForm"



    // $ANTLR start "list"
    // grammar/Clojure.g:231:1: list : o= OPEN_PAREN ( form )* c= CLOSE_PAREN ;
    public final void list() throws RecognitionException {
        Token o=null;
        Token c=null;

        try {
            // grammar/Clojure.g:231:5: (o= OPEN_PAREN ( form )* c= CLOSE_PAREN )
            // grammar/Clojure.g:231:9: o= OPEN_PAREN ( form )* c= CLOSE_PAREN
            {
            o=(Token)match(input,OPEN_PAREN,FOLLOW_OPEN_PAREN_in_list1602); 

            // grammar/Clojure.g:231:22: ( form )*
            loop7:
            do {
                int alt7=2;
                int LA7_0 = input.LA(1);

                if ( ((LA7_0 >= AMPERSAND && LA7_0 <= APOSTROPHE)||(LA7_0 >= BOOLEAN && LA7_0 <= CIRCUMFLEX)||(LA7_0 >= COMMENT && LA7_0 <= COMMERCIAL_AT)||(LA7_0 >= KEYWORD && LA7_0 <= LEFT_SQUARE_BRACKET)||(LA7_0 >= NIL && LA7_0 <= OPEN_PAREN)||LA7_0==REGEX_LITERAL||(LA7_0 >= SPECIAL_FORM && LA7_0 <= SYMBOL)||(LA7_0 >= SYNTAX_QUOTE && LA7_0 <= UNQUOTE_SPLICING)) ) {
                    alt7=1;
                }


                switch (alt7) {
            	case 1 :
            	    // grammar/Clojure.g:231:22: form
            	    {
            	    pushFollow(FOLLOW_form_in_list1604);
            	    form();

            	    state._fsp--;


            	    }
            	    break;

            	default :
            	    break loop7;
                }
            } while (true);


            c=(Token)match(input,CLOSE_PAREN,FOLLOW_CLOSE_PAREN_in_list1610); 

             parensMatching.put(Integer.valueOf(o.getTokenIndex()), Integer.valueOf(c.getTokenIndex())); parensMatching.put(Integer.valueOf(c.getTokenIndex()), Integer.valueOf(o.getTokenIndex())); 

            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "list"



    // $ANTLR start "vector"
    // grammar/Clojure.g:234:1: vector : LEFT_SQUARE_BRACKET ( form )* RIGHT_SQUARE_BRACKET ;
    public final void vector() throws RecognitionException {
        try {
            // grammar/Clojure.g:234:7: ( LEFT_SQUARE_BRACKET ( form )* RIGHT_SQUARE_BRACKET )
            // grammar/Clojure.g:234:10: LEFT_SQUARE_BRACKET ( form )* RIGHT_SQUARE_BRACKET
            {
            match(input,LEFT_SQUARE_BRACKET,FOLLOW_LEFT_SQUARE_BRACKET_in_vector1629); 

            // grammar/Clojure.g:234:30: ( form )*
            loop8:
            do {
                int alt8=2;
                int LA8_0 = input.LA(1);

                if ( ((LA8_0 >= AMPERSAND && LA8_0 <= APOSTROPHE)||(LA8_0 >= BOOLEAN && LA8_0 <= CIRCUMFLEX)||(LA8_0 >= COMMENT && LA8_0 <= COMMERCIAL_AT)||(LA8_0 >= KEYWORD && LA8_0 <= LEFT_SQUARE_BRACKET)||(LA8_0 >= NIL && LA8_0 <= OPEN_PAREN)||LA8_0==REGEX_LITERAL||(LA8_0 >= SPECIAL_FORM && LA8_0 <= SYMBOL)||(LA8_0 >= SYNTAX_QUOTE && LA8_0 <= UNQUOTE_SPLICING)) ) {
                    alt8=1;
                }


                switch (alt8) {
            	case 1 :
            	    // grammar/Clojure.g:234:30: form
            	    {
            	    pushFollow(FOLLOW_form_in_vector1631);
            	    form();

            	    state._fsp--;


            	    }
            	    break;

            	default :
            	    break loop8;
                }
            } while (true);


            match(input,RIGHT_SQUARE_BRACKET,FOLLOW_RIGHT_SQUARE_BRACKET_in_vector1634); 

            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "vector"



    // $ANTLR start "map"
    // grammar/Clojure.g:237:1: map : LEFT_CURLY_BRACKET ( form form )* RIGHT_CURLY_BRACKET ;
    public final void map() throws RecognitionException {
        try {
            // grammar/Clojure.g:237:4: ( LEFT_CURLY_BRACKET ( form form )* RIGHT_CURLY_BRACKET )
            // grammar/Clojure.g:237:9: LEFT_CURLY_BRACKET ( form form )* RIGHT_CURLY_BRACKET
            {
            match(input,LEFT_CURLY_BRACKET,FOLLOW_LEFT_CURLY_BRACKET_in_map1653); 

            // grammar/Clojure.g:237:28: ( form form )*
            loop9:
            do {
                int alt9=2;
                int LA9_0 = input.LA(1);

                if ( ((LA9_0 >= AMPERSAND && LA9_0 <= APOSTROPHE)||(LA9_0 >= BOOLEAN && LA9_0 <= CIRCUMFLEX)||(LA9_0 >= COMMENT && LA9_0 <= COMMERCIAL_AT)||(LA9_0 >= KEYWORD && LA9_0 <= LEFT_SQUARE_BRACKET)||(LA9_0 >= NIL && LA9_0 <= OPEN_PAREN)||LA9_0==REGEX_LITERAL||(LA9_0 >= SPECIAL_FORM && LA9_0 <= SYMBOL)||(LA9_0 >= SYNTAX_QUOTE && LA9_0 <= UNQUOTE_SPLICING)) ) {
                    alt9=1;
                }


                switch (alt9) {
            	case 1 :
            	    // grammar/Clojure.g:237:29: form form
            	    {
            	    pushFollow(FOLLOW_form_in_map1656);
            	    form();

            	    state._fsp--;


            	    pushFollow(FOLLOW_form_in_map1658);
            	    form();

            	    state._fsp--;


            	    }
            	    break;

            	default :
            	    break loop9;
                }
            } while (true);


            match(input,RIGHT_CURLY_BRACKET,FOLLOW_RIGHT_CURLY_BRACKET_in_map1662); 

            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "map"



    // $ANTLR start "quoteForm"
    // grammar/Clojure.g:240:1: quoteForm : APOSTROPHE form ;
    public final void quoteForm() throws RecognitionException {
         this.syntaxQuoteDepth++; 
        try {
            // grammar/Clojure.g:243:5: ( APOSTROPHE form )
            // grammar/Clojure.g:243:8: APOSTROPHE form
            {
            match(input,APOSTROPHE,FOLLOW_APOSTROPHE_in_quoteForm1695); 

            pushFollow(FOLLOW_form_in_quoteForm1697);
            form();

            state._fsp--;


            }

             this.syntaxQuoteDepth--; 
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "quoteForm"



    // $ANTLR start "metaForm"
    // grammar/Clojure.g:246:1: metaForm : CIRCUMFLEX form ;
    public final void metaForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:246:9: ( CIRCUMFLEX form )
            // grammar/Clojure.g:246:13: CIRCUMFLEX form
            {
            match(input,CIRCUMFLEX,FOLLOW_CIRCUMFLEX_in_metaForm1711); 

            pushFollow(FOLLOW_form_in_metaForm1713);
            form();

            state._fsp--;


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "metaForm"



    // $ANTLR start "derefForm"
    // grammar/Clojure.g:249:1: derefForm : COMMERCIAL_AT form ;
    public final void derefForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:249:10: ( COMMERCIAL_AT form )
            // grammar/Clojure.g:249:13: COMMERCIAL_AT form
            {
            match(input,COMMERCIAL_AT,FOLLOW_COMMERCIAL_AT_in_derefForm1730); 

            pushFollow(FOLLOW_form_in_derefForm1732);
            form();

            state._fsp--;


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "derefForm"



    // $ANTLR start "syntaxQuoteForm"
    // grammar/Clojure.g:252:1: syntaxQuoteForm : SYNTAX_QUOTE form ;
    public final void syntaxQuoteForm() throws RecognitionException {
         this.syntaxQuoteDepth++; 
        try {
            // grammar/Clojure.g:255:5: ( SYNTAX_QUOTE form )
            // grammar/Clojure.g:256:9: SYNTAX_QUOTE form
            {
            match(input,SYNTAX_QUOTE,FOLLOW_SYNTAX_QUOTE_in_syntaxQuoteForm1772); 

            pushFollow(FOLLOW_form_in_syntaxQuoteForm1774);
            form();

            state._fsp--;


            }

             this.syntaxQuoteDepth--; 
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "syntaxQuoteForm"



    // $ANTLR start "unquoteForm"
    // grammar/Clojure.g:259:1: unquoteForm : UNQUOTE form ;
    public final void unquoteForm() throws RecognitionException {
         this.syntaxQuoteDepth--; 
        try {
            // grammar/Clojure.g:262:5: ( UNQUOTE form )
            // grammar/Clojure.g:263:9: UNQUOTE form
            {
            match(input,UNQUOTE,FOLLOW_UNQUOTE_in_unquoteForm1814); 

            pushFollow(FOLLOW_form_in_unquoteForm1816);
            form();

            state._fsp--;


            }

             this.syntaxQuoteDepth++; 
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "unquoteForm"



    // $ANTLR start "unquoteSplicingForm"
    // grammar/Clojure.g:266:1: unquoteSplicingForm : UNQUOTE_SPLICING form ;
    public final void unquoteSplicingForm() throws RecognitionException {
         this.syntaxQuoteDepth--; 
        try {
            // grammar/Clojure.g:269:5: ( UNQUOTE_SPLICING form )
            // grammar/Clojure.g:270:9: UNQUOTE_SPLICING form
            {
            match(input,UNQUOTE_SPLICING,FOLLOW_UNQUOTE_SPLICING_in_unquoteSplicingForm1856); 

            pushFollow(FOLLOW_form_in_unquoteSplicingForm1858);
            form();

            state._fsp--;


            }

             this.syntaxQuoteDepth++; 
        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "unquoteSplicingForm"



    // $ANTLR start "set"
    // grammar/Clojure.g:273:1: set : NUMBER_SIGN LEFT_CURLY_BRACKET ( form )* RIGHT_CURLY_BRACKET ;
    public final void set() throws RecognitionException {
        try {
            // grammar/Clojure.g:273:4: ( NUMBER_SIGN LEFT_CURLY_BRACKET ( form )* RIGHT_CURLY_BRACKET )
            // grammar/Clojure.g:273:9: NUMBER_SIGN LEFT_CURLY_BRACKET ( form )* RIGHT_CURLY_BRACKET
            {
            match(input,NUMBER_SIGN,FOLLOW_NUMBER_SIGN_in_set1877); 

            match(input,LEFT_CURLY_BRACKET,FOLLOW_LEFT_CURLY_BRACKET_in_set1879); 

            // grammar/Clojure.g:273:40: ( form )*
            loop10:
            do {
                int alt10=2;
                int LA10_0 = input.LA(1);

                if ( ((LA10_0 >= AMPERSAND && LA10_0 <= APOSTROPHE)||(LA10_0 >= BOOLEAN && LA10_0 <= CIRCUMFLEX)||(LA10_0 >= COMMENT && LA10_0 <= COMMERCIAL_AT)||(LA10_0 >= KEYWORD && LA10_0 <= LEFT_SQUARE_BRACKET)||(LA10_0 >= NIL && LA10_0 <= OPEN_PAREN)||LA10_0==REGEX_LITERAL||(LA10_0 >= SPECIAL_FORM && LA10_0 <= SYMBOL)||(LA10_0 >= SYNTAX_QUOTE && LA10_0 <= UNQUOTE_SPLICING)) ) {
                    alt10=1;
                }


                switch (alt10) {
            	case 1 :
            	    // grammar/Clojure.g:273:40: form
            	    {
            	    pushFollow(FOLLOW_form_in_set1881);
            	    form();

            	    state._fsp--;


            	    }
            	    break;

            	default :
            	    break loop10;
                }
            } while (true);


            match(input,RIGHT_CURLY_BRACKET,FOLLOW_RIGHT_CURLY_BRACKET_in_set1884); 

            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "set"



    // $ANTLR start "metadataForm"
    // grammar/Clojure.g:276:1: metadataForm : NUMBER_SIGN CIRCUMFLEX ( map | SYMBOL | KEYWORD | STRING ) ;
    public final void metadataForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:276:13: ( NUMBER_SIGN CIRCUMFLEX ( map | SYMBOL | KEYWORD | STRING ) )
            // grammar/Clojure.g:277:9: NUMBER_SIGN CIRCUMFLEX ( map | SYMBOL | KEYWORD | STRING )
            {
            match(input,NUMBER_SIGN,FOLLOW_NUMBER_SIGN_in_metadataForm1904); 

            match(input,CIRCUMFLEX,FOLLOW_CIRCUMFLEX_in_metadataForm1906); 

            // grammar/Clojure.g:277:32: ( map | SYMBOL | KEYWORD | STRING )
            int alt11=4;
            switch ( input.LA(1) ) {
            case LEFT_CURLY_BRACKET:
                {
                alt11=1;
                }
                break;
            case SYMBOL:
                {
                alt11=2;
                }
                break;
            case KEYWORD:
                {
                alt11=3;
                }
                break;
            case STRING:
                {
                alt11=4;
                }
                break;
            default:
                NoViableAltException nvae =
                    new NoViableAltException("", 11, 0, input);

                throw nvae;

            }

            switch (alt11) {
                case 1 :
                    // grammar/Clojure.g:277:33: map
                    {
                    pushFollow(FOLLOW_map_in_metadataForm1909);
                    map();

                    state._fsp--;


                    }
                    break;
                case 2 :
                    // grammar/Clojure.g:277:39: SYMBOL
                    {
                    match(input,SYMBOL,FOLLOW_SYMBOL_in_metadataForm1913); 

                    }
                    break;
                case 3 :
                    // grammar/Clojure.g:277:46: KEYWORD
                    {
                    match(input,KEYWORD,FOLLOW_KEYWORD_in_metadataForm1915); 

                    }
                    break;
                case 4 :
                    // grammar/Clojure.g:277:54: STRING
                    {
                    match(input,STRING,FOLLOW_STRING_in_metadataForm1917); 

                    }
                    break;

            }


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "metadataForm"



    // $ANTLR start "varQuoteForm"
    // grammar/Clojure.g:280:1: varQuoteForm : NUMBER_SIGN APOSTROPHE form ;
    public final void varQuoteForm() throws RecognitionException {
        try {
            // grammar/Clojure.g:280:13: ( NUMBER_SIGN APOSTROPHE form )
            // grammar/Clojure.g:281:9: NUMBER_SIGN APOSTROPHE form
            {
            match(input,NUMBER_SIGN,FOLLOW_NUMBER_SIGN_in_varQuoteForm1938); 

            match(input,APOSTROPHE,FOLLOW_APOSTROPHE_in_varQuoteForm1940); 

            pushFollow(FOLLOW_form_in_varQuoteForm1942);
            form();

            state._fsp--;


            }

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "varQuoteForm"



    // $ANTLR start "lambdaForm"
    // grammar/Clojure.g:284:1: lambdaForm : NUMBER_SIGN list ;
    public final void lambdaForm() throws RecognitionException {

        this.inLambda = true;

        try {
            // grammar/Clojure.g:291:5: ( NUMBER_SIGN list )
            // grammar/Clojure.g:291:7: NUMBER_SIGN list
            {
            match(input,NUMBER_SIGN,FOLLOW_NUMBER_SIGN_in_lambdaForm1969); 

            pushFollow(FOLLOW_list_in_lambdaForm1971);
            list();

            state._fsp--;


            }


            this.inLambda = false;

        }
        catch (RecognitionException re) {
            reportError(re);
            recover(input,re);
        }

        finally {
        	// do for sure before leaving
        }
        return ;
    }
    // $ANTLR end "lambdaForm"

    // Delegated rules


 

    public static final BitSet FOLLOW_form_in_file1304 = new BitSet(new long[]{0x00000039C5E79BB2L});
    public static final BitSet FOLLOW_LAMBDA_ARG_in_form1337 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_literal_in_form1348 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_COMMENT_in_form1374 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_AMPERSAND_in_form1384 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_metadataForm_in_form1394 = new BitSet(new long[]{0x0000000141060000L});
    public static final BitSet FOLLOW_SPECIAL_FORM_in_form1399 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_SYMBOL_in_form1405 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_list_in_form1411 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_vector_in_form1415 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_map_in_form1419 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_macroForm_in_form1431 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_dispatchMacroForm_in_form1441 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_set_in_form1451 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_quoteForm_in_macroForm1482 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_metaForm_in_macroForm1492 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_derefForm_in_macroForm1502 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_syntaxQuoteForm_in_macroForm1512 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_unquoteSplicingForm_in_macroForm1522 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_unquoteForm_in_macroForm1532 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_REGEX_LITERAL_in_dispatchMacroForm1559 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_varQuoteForm_in_dispatchMacroForm1569 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_lambdaForm_in_dispatchMacroForm1581 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_OPEN_PAREN_in_list1602 = new BitSet(new long[]{0x00000039C5E79FB0L});
    public static final BitSet FOLLOW_form_in_list1604 = new BitSet(new long[]{0x00000039C5E79FB0L});
    public static final BitSet FOLLOW_CLOSE_PAREN_in_list1610 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_LEFT_SQUARE_BRACKET_in_vector1629 = new BitSet(new long[]{0x00000039D5E79BB0L});
    public static final BitSet FOLLOW_form_in_vector1631 = new BitSet(new long[]{0x00000039D5E79BB0L});
    public static final BitSet FOLLOW_RIGHT_SQUARE_BRACKET_in_vector1634 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_LEFT_CURLY_BRACKET_in_map1653 = new BitSet(new long[]{0x00000039CDE79BB0L});
    public static final BitSet FOLLOW_form_in_map1656 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_map1658 = new BitSet(new long[]{0x00000039CDE79BB0L});
    public static final BitSet FOLLOW_RIGHT_CURLY_BRACKET_in_map1662 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_APOSTROPHE_in_quoteForm1695 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_quoteForm1697 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_CIRCUMFLEX_in_metaForm1711 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_metaForm1713 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_COMMERCIAL_AT_in_derefForm1730 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_derefForm1732 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_SYNTAX_QUOTE_in_syntaxQuoteForm1772 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_syntaxQuoteForm1774 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_UNQUOTE_in_unquoteForm1814 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_unquoteForm1816 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_UNQUOTE_SPLICING_in_unquoteSplicingForm1856 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_unquoteSplicingForm1858 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_NUMBER_SIGN_in_set1877 = new BitSet(new long[]{0x0000000000020000L});
    public static final BitSet FOLLOW_LEFT_CURLY_BRACKET_in_set1879 = new BitSet(new long[]{0x00000039CDE79BB0L});
    public static final BitSet FOLLOW_form_in_set1881 = new BitSet(new long[]{0x00000039CDE79BB0L});
    public static final BitSet FOLLOW_RIGHT_CURLY_BRACKET_in_set1884 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_NUMBER_SIGN_in_metadataForm1904 = new BitSet(new long[]{0x0000000000000200L});
    public static final BitSet FOLLOW_CIRCUMFLEX_in_metadataForm1906 = new BitSet(new long[]{0x0000000180028000L});
    public static final BitSet FOLLOW_map_in_metadataForm1909 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_SYMBOL_in_metadataForm1913 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_KEYWORD_in_metadataForm1915 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_STRING_in_metadataForm1917 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_NUMBER_SIGN_in_varQuoteForm1938 = new BitSet(new long[]{0x0000000000000020L});
    public static final BitSet FOLLOW_APOSTROPHE_in_varQuoteForm1940 = new BitSet(new long[]{0x00000039C5E79BB0L});
    public static final BitSet FOLLOW_form_in_varQuoteForm1942 = new BitSet(new long[]{0x0000000000000002L});
    public static final BitSet FOLLOW_NUMBER_SIGN_in_lambdaForm1969 = new BitSet(new long[]{0x0000000001000000L});
    public static final BitSet FOLLOW_list_in_lambdaForm1971 = new BitSet(new long[]{0x0000000000000002L});

}