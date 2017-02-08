/**
 * Created by malone on 15/09/15.
 *
 * Modified by prodenas on 19/01/16
 *
 */

$(document).ready( function() {

    // constructs the suggestion engine
    var engine = new Bloodhound({
        datumTokenizer: function (datum) {
            return Bloodhound.tokenizers.whitespace(datum.label);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        sufficient: 199,
        prefetch: {
            url: '../static/files/sample.json',
            //cache: false,
            filter: function(response) {
                console.log("THIS WORKS HERE TOO")
                //console.log(response)
                return $.map(response, function(item) {
                    return {
                      labels: item.labels,
                      label: item.labels,
                      ontology_acronym : item.ontology_acronym,
                      short_form : item.short_form,
                      json_document: item
                    }
                });
            }
        },
        identify : function(item) {
            //console.log('identify GETS CALLED ' + item.label);
            return item.label + item.ontology_acronym + item.short_form;
        },
        sorter: function(a, b) {
          if (typeof a.labels !== 'undefined') {
                //get input text
            var InputString=   $('[id^="id_q"]').val();

                //move exact matches to top
            if(InputString==a.labels){ return -1;}
            if(InputString==b.labels){return 1;}

                //close match without case matching
            if(InputString.toLowerCase() == a.labels.toLowerCase()){ return -1;}
            if(InputString.toLowerCase()==b.labels.toLowerCase()){return 1;}

                //Single token or multiple
            if ( a["norm(labels)"] == 1 ){
                    //decreasing value of Lucene/Solr label norm metric
                if (a["norm(labels)"]>b["norm(labels)"]) {
                    return -1
                } else {
                        //input string is label string prefix
                    if( a.labels.toLowerCase().indexOf(InputString.toLowerCase()) == 0 ){
                        if( b.labels.toLowerCase().indexOf(InputString.toLowerCase()) !== 0 ){ return -1; }
                    } else {
                        if( b.labels.toLowerCase().indexOf(InputString.toLowerCase()) == 0 ){ return 1; }
                    }
                        //increasing string length
                    if (a.labels.length < b.labels.length) {
                        return -1;
                    } else {
                        if (a.labels.length > b.labels.length) {
                            return 1;
                        } else {
                            //relegate containing digit or capital letter
                            if (/\d/.test(a.labels)) { return 1 }
                            if (/\d/.test(b.labels)) { return -1 }

                            if ((a.labels.length>1) && (a.labels.slice(1,a.labels.length) !== a.labels.slice(1,a.labels.length).toLowerCase() )) {
                                return 1
                            }
                            if ((b.labels.length>1) && (b.labels.slice(1,b.labels.length) !== b.labels.slice(1,b.labels.length).toLowerCase() )) {
                                return -1
                            }

                            //alphabetical order
                            return a.labels.localeCompare(b.labels);
                        }
                    }
                }
            } else {
                    //input string is label string prefix
                if( a.labels.toLowerCase().indexOf(InputString.toLowerCase()) == 0 ){ return -1;}
                if( b.labels.toLowerCase().indexOf(InputString.toLowerCase()) == 0 ){ return 1; }
                    //input string contained in label string
                if( a.labels.toLowerCase().indexOf(InputString.toLowerCase())!== -1 ){ return -1;}
                if( b.labels.toLowerCase().indexOf(InputString.toLowerCase())!== -1 ){ return 1; }

                if (a["norm(labels)"]>b["norm(labels)"]) { return -1 }
                if (a["norm(labels)"]<b["norm(labels)"]) { return 1 }
                //return a.labels.localeCompare(b.labels);
            }
          } else {
            return -1;
          }
        },
        remote: {
            // What may be a relevant size of class subset for the user to select from VS. transaction size x user population?
            /*url: window.location.protocol + '//b2note.bsc.es/solr/b2note_index/select?q=labels:%QUERY&wt=json&indent=true&rows=1000',*/
            /*url: window.location.protocol + '//b2note.bsc.es/solr/cleanup_test/select',*/
            url: 'https://b2note.bsc.es/solr/cleanup_test/select',
            /*url: window.location.protocol + '//b2note.bsc.es/solr/b2note_index/select',*/
            /* 20161109, abremaud@escienceafactory.com
                Boosting exact match on term label from Solr.
                http://stackoverflow.com/questions/37712129/how-to-use-typeahead-wildcard */
            /*wildcard: '%QUERY',*/
            /*rateLimitBy: 'debounce',*/
            /*rateLimitWait: 1400,*/
            prepare: function(query, settings) {
                if ((query.length<=4) && (query.split(/-_ /).length<=1)) {
                    //console.log("Less than four letters single word input")
                    settings.url += '?q=((labels:/' + query +'.*/)';
                } else {
                    //console.log("More than four letters or mutliple words input")
                    settings.url += '?q=((labels:"' + query +'"^100%20OR%20labels:' + query +'*^20%20OR%20text_auto:/' + query +'.*/^10%20OR%20labels:*' + query + '*)';
                }
                settings.url += '%20AND%20NOT%20(labels:/Error[0-9].*/))'
                if (query.split(/[^A-Za-z0-9]/).length<=1) {
                    //alert("single-word");
                    settings.url += '&sort=norm(labels) desc';
                }
                settings.url += '&fl=labels,uris,ontology_acronym,short_form,synonyms,norm(labels)&wt=json&indent=true&rows=1000';
                return settings;
            },
            filter: function (data) {
                qstr = ""
                if (data.responseHeader.params.q){
                    beg = data.responseHeader.params.q.indexOf(':/');
                    fin = data.responseHeader.params.q.indexOf('.*');
                    qstr = data.responseHeader.params.q.substring(beg+2,fin);
                }
                truncated_data = engine.sorter(data.response.docs);
                trunc_n = 1000;
                if ((qstr.length<=4) && (qstr.split(/-_ /).length<=1)) {
                    trunc_n = 100;
                }
                if (truncated_data.length>trunc_n) {
                    truncated_data = truncated_data.slice(0,trunc_n);
                }
                console.log('Matches (n): '+ data.response.numFound + ', Solr response time (ms): ' + data.responseHeader.QTime + ', Display: ' + truncated_data.length)
                return $.map(truncated_data, function (suggestionSet) {
                //return $.map(engine.sorter(data.response.docs), function (suggestionSet) {
                //return $.map(data.response.docs, function (suggestionSet) {
                    return{
                        label : suggestionSet.labels,
                        ontology_acronym : suggestionSet.ontology_acronym,
                        short_form : suggestionSet.short_form,
			            json_document: suggestionSet
                    };
                });
            }
        }
    });

    // initializes the engine
    engine.clearPrefetchCache();
    engine.initialize();

    // gets the subject selected to provide the subject_tofeed field
    var elem = document.getElementById("section_subject");
    var subject = "";
    var db_id = "";
    if (elem) {
    	subject = elem.getElementsByTagName("a")[0].innerHTML;
    } else {
        // abremaud@esciencefactory.com, 20160922
        // Handling typeahead from edit_annotation page
        if (document.getElementById("db_id")) {
            db_id = document.getElementById("db_id").value;
        }
    }
    // abremaud@esciencefactory.com, 20160129
    // gets the pid selected to provide the pid_tofeed field
    elem = document.getElementById("section_subject");
    var pid = "test";
    if (elem) {
    	pid = elem.getElementsByTagName("a")[1].innerHTML;
    }

    //$.ajaxSetup({data: {csrfmiddlewaretoken: '{{ csrf_token }}' },});

    // selects the html element where the suggestion takes places
    //$('#id_q').typeahead({
    $('[id^="id_q"]').typeahead({
            hint: true,
            highlight: true,
            minLength: 1,
        },
        {
            name: 'engine',
	        display: function(data) {
	            //console.log("TEST")
                return data.label + '  (' + data.ontology_acronym + ':' + data.short_form + ')';
            },

            source: engine.ttAdapter(),

            // Fix from: https://github.com/twitter/typeahead.js/issues/1232
            limit: Infinity,

            templates: {
                pending: '<div class="pending-message" style="color:#cccccc;">Suggestions incoming...</div>',
                empty: [
                    '<div class="empty-message">',
                    ' -No results-',
                    '</div>'
                ].join('\n'),
                suggestion: Handlebars.compile('<p class="Typeahead-input tt-input">{{label}}' + ' ({{short_form}})</p>')
            },
            engine: Handlebars
	// defines the event 'onclick'
        }).on('typeahead:selected', function(evt, data) {
	     /* pablo.rodenas@bsc.es, 19012016
	      *
	      * Problem: AJAX post method alone does not redirect to Django page.
	      *
	      * JS: http://stackoverflow.com/questions/29137910/redirecting-after-ajax-post-in-django
	      *
	      * (otherwise in Django): http://stackoverflow.com/questions/2140568/django-view-does-not-redirect-when-request-by-jquery-post
	      *
	      * Code source: https://github.com/mgalante/jquery.redirect
	      *
              */

            //if (document.getElementById("section_subject")) {
            if (document.getElementById("semantic")) {
                $('#ontology_json').val( JSON.stringify(data.json_document) )
            } else {
                $('#'+this.parentElement.parentElement.querySelector('[id^="ontology_json"]').name).val( JSON.stringify(data.json_document) )
            }

//              abremaud 20161025, stop creating anntation upon simply selecting one entry,
//              instead selection label is output to the typeahead text-box while full information json
//              gets outputed to a hiden input for being POSTED upon user hitting submit...
//                $.redirect('create_annotation',
//                    {
//                    ontology_json: JSON.stringify(data.json_document),
//                    subject_tofeed: subject,
//                    pid_tofeed: pid,
//                    // abremaud@esciencefactory.com, 20160926
//                    // retrieve Django csrf token from html hidden input element
//                    csrfmiddlewaretoken: this.parentElement.previousElementSibling.value,
//                });

//            } else {
//                if (db_id != "") {
//                    $.redirect('edit_annotation',
//                        {
//                        ontology_json: JSON.stringify(data.json_document),
//                        db_id: db_id,
//                        // abremaud@esciencefactory.com, 20160926
//                        // retrieve Django csrf token from html hidden input element
//                        csrfmiddlewaretoken: this.parentElement.parentElement.firstChild.nextSibling.value,
//                    });
//                } else {
//                    $.redirect('search_annotation',
//                        {
//                        // abremaud@esciencefactory.com, 20160928
//                        // search annotations on keyword
//                        ontology_json: JSON.stringify(data.json_document),
//                        csrfmiddlewaretoken: this.form.firstChild.nextSibling.value,
//                    });
//                }
//            };
    });
});
